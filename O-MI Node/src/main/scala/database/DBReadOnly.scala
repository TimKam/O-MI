package database

import scala.language.postfixOps

import slick.driver.H2Driver.api._
import java.sql.Timestamp

import scala.concurrent.ExecutionContext.Implicits.global
import scala.concurrent.Future
import scala.collection.JavaConversions.asJavaIterable
import scala.collection.JavaConversions.iterableAsScalaIterable
import scala.collection.SortedMap

import types._
import types.OdfTypes._

import java.lang.RuntimeException

/**
 * Read only restricted interface methods for db tables
 */
trait DBReadOnly extends DBBase with OdfConversions with DBUtility with OmiNodeTables {


  protected def findParentI(childPath: Path): DBIOro[Option[DBNode]] = findParentQ(childPath).result.headOption

  protected def findParentQ(childPath: Path) = (
    if (childPath.length == 0)
      hierarchyNodes filter (_.path === childPath)
    else
      hierarchyNodes filter (_.path === Path(childPath.init))
  )

  /**
   * Used to get metadata from database for given path
   * @param path path to sensor whose metadata is requested
   *
   * @return metadata as Option[String], none if no data is found
   */
  def getMetaData(path: Path): Option[OdfMetaData] = runSync(getMetaDataI(path))

  protected def getMetaDataI(path: Path): DBIOro[Option[OdfMetaData]] = {
    val queryResult = getWithHierarchyQ[DBMetaData, DBMetaDatasTable](path, metadatas).result
    queryResult map (
      _.headOption map (_.toOdf)
    )
  }
  protected def getMetaDataI(id: Int): DBIO[Option[OdfMetaData]] =
    (metadatas filter (_.hierarchyId === id)).result map (
      _.headOption map (_.toOdf)
    )


  protected def withSubData(subId: Int)(handleInfoItems: DBInfoItem => DBInfoItem): Option[OdfObjects] = {
    val subItemNodesI = hierarchyNodes.filter(
      //XXX:
      _.id.inSet( runSync( getSubItemHierarchyIdsI(subId) ) )
    ).result

    val hierarchy = subItemNodesI.flatMap{
      subItemNodes => {
        val subTreeData =
          subItemNodes map { node =>
            getSubTreeI(node.path) map {
              toDBInfoItems( _ ) map handleInfoItems
            }
          }
        dbioDBInfoItemsSum(subTreeData)
      }
    }
   runSync( hierarchy map odfConversion )
  }

  /**
   * Get data for Interval subscription with callback.
   * Result consists of all sensor values after beginning of the subscription
   * for all the sensors in the subscription
   * returns empty array if no data or subscription is found
   *
   * @param subId subscription id that is assigned during saving the subscription
   *
   * @return objects
   */
  def getSubData(subId: Int): Option[OdfObjects] = withSubData(subId){
    case (node, seqVals) =>
      val sortedValues = seqVals.sortBy( _.timestamp.getTime )
      ( node, sortedValues.take(1) )
  }

  protected def getSubItemHierarchyIdsI(subId: Int) =
    subItems filter (
      _.subId === subId
    ) map ( _.hierarchyId ) result

  /**
   * Get poll data for subscription without callback.
   * @param subId Subscription id
   * @param newTime Timestamp for the poll time, might be the new start time for the subscription
   */
  def getPollData(subId: Int, newTime: Timestamp): Option[OdfObjects] ={
    val sub  = getSub( subId ) match {
      case None => 
        return None 
      case Some(s) => s
    }
    
    val subitems = runSync( 
      subItems.filter( _.subId === subId ).result 
    ).groupBy( _.hierarchyId ).map{ case (hId, valueSeq) => (hId, valueSeq.take(1))} 
    var updateActions : DBIO[Unit] = DBIO.successful[Unit](():Unit)

    def handleEventPoll(node: DBNode, dbsub: DBSub, sortedValues: Seq[DBValue]): Seq[DBValue] = {
      //GET all vals
      val dbvals = getBetween(
          sortedValues, dbsub.startTime, newTime
        ).sortBy( _.timestamp.getTime ).dropWhile{ value =>//drops values from start that are same than before
          subitems(value.hierarchyId).headOption match {
            case Some( headVal) => 
              headVal.lastValue.exists{  lastValue => lastValue == value }
            case None => false
          }
        }.foldLeft(Seq.empty[DBValue])(//Reduce are subsequences with same value  to one element
          (a, b) => if (a.lastOption.exists(n => n.value == b.value)) a else a :+ b
        ).sortBy( _.timestamp.getTime )

      updateActions = DBIO.seq(
        updateActions,
        subItems.filter{_.hierarchyId === node.id }.update(//Update SubItems lastValues
          DBSubscriptionItem( dbsub.id, node.id.get, dbvals.lastOption.map{ dbval => dbval.value } ) 
        )
      )
      dbvals
    }
    
    val odfOption = withSubData(subId){
      case (node, seqVals) =>
        val newVals = {
          //Get right data for each infoitem
          val sortedValues = seqVals.sortBy( _.timestamp.getTime )
          if( sub.isEventBased ){
            handleEventPoll(node, sub, sortedValues)
          } else { //Normal poll
          //Get values for each interval
            getByIntervalBetween(sortedValues, sub.startTime, newTime, sub.interval.toLong )
          }
        }
        ( node, newVals )
    }
    updateActions = DBIO.seq(
      updateActions,
      subs.filter{_.id === sub.id }update(//Sub update
        DBSub(
          sub.id,
          sub.interval,
          new Timestamp(
            (
              sub.startTime.getTime  + 
              ( (( newTime.getTime - sub.startTime.getTime)/1000 )/ sub.interval).toInt * sub.interval * 1000
            ).toLong
          ),
          sub.ttl - ( (( newTime.getTime - sub.startTime.getTime)/1000.0)/ sub.interval).toInt * sub.interval,//Intervals between 
          sub.callback
        )
      )
    )
    runSync(updateActions)
    odfOption
  }

  def getBetween( values: Seq[DBValue], after: Timestamp, before: Timestamp ) = {
    values.filter( value => (value.timestamp.equals(before) || value.timestamp.before( before )) && (value.timestamp.equals( after ) || value.timestamp.after( after )) )
  }
  def getByIntervalBetween(values: Seq[DBValue] , beginTime: Timestamp, endTime: Timestamp, interval: Long ) = {
    var intervalTime =
      endTime.getTime - (endTime.getTime - beginTime.getTime)%interval // last interval before poll
    var timeframe  = values.sortBy(
        value =>
        value.timestamp.getTime
      ) //ascending
   
    var intervalValues : Seq[DBValue] = Seq.empty
    var index = 1

    while( index > -1 && intervalTime >= beginTime.getTime ){
      index = timeframe.lastIndexWhere( value => value.timestamp.getTime <= intervalTime )
      if( index > -1) {
        intervalValues = intervalValues :+ timeframe( index )
        intervalTime -= interval
      }
    }   
    intervalValues.reverse
  }


  /**
   * Used to get data from database based on given path.
   * returns Some(OdfInfoItem) if path leads to sensor and if
   * path leads to object returns Some(OdfObject).
   * OdfObject has childs as infoitems and objects.
   * if nothing is found for given path returns None
   *
   * @param path path to search data from
   *
   * @return either Some(OdfInfoItem),Some(OdfObject) or None based on where the path leads to
   */
  def get(path: Path): Option[ HasPath ] = runSync(getQ(path))

  //def getQ(single: OdfElement): OdfElement = ???
  def getQ(path: Path): DBIOro[Option[HasPath]] = for {

    subTreeData <- getSubTreeI(path, depth=Some(1))

    dbInfoItems  = toDBInfoItems(subTreeData)

    result = singleObjectConversion(dbInfoItems)

  } yield result


  /**
   * Used to get sensor values with given constrains. first the two optional timestamps, if both are given
   * search is targeted between these two times. If only start is given,all values from start time onwards are
   * targeted. Similiarly if only end is given, values before end time are targeted.
   *    Then the two Int values. Only one of these can be present. fromStart is used to select fromStart number
   * of values from the begining of the targeted area. Similiarly from ends selects fromEnd number of values from
   * the end.
   * All parameters except path are optional, given only path returns all values in the database for that path
   *
   * @param path path as Path object
   * @param start optional start Timestamp
   * @param end optional end Timestamp
   * @param fromStart number of values to be returned from start
   * @param fromEnd number of values to be returned from end
   * @return query for the requested values
   */
  protected def getNBetweenDBInfoItemQ(
    id: Int,
    begin: Option[Timestamp],
    end: Option[Timestamp],
    newest: Option[Int],
    oldest: Option[Int]
  ): Query[DBValuesTable,DBValue,Seq] =
    nBetweenLogicQ(getValuesQ(id), begin, end, newest, oldest)


  /**
   * Makes a Query which filters, limits and sorts as limited by the parameters.
   * See [[getNBetween]].
   * @param getter Gets DBValue from some ValueType for filtering and sorting
   */
  protected def nBetweenLogicQ(
    values: Query[DBValuesTable,DBValue,Seq],
    begin: Option[Timestamp],
    end: Option[Timestamp],
    newest: Option[Int],
    oldest: Option[Int]
  ): Query[DBValuesTable,DBValue,Seq] = {
    val timeFrame = values filter betweenLogicR(begin, end)

    // NOTE: duplicate code: takeLogic
    val query = 
      if ( oldest.nonEmpty ) {
        timeFrame sortBy ( _.timestamp.asc ) take (oldest.get) //sortBy (_.timestamp.asc)
      } else if ( newest.nonEmpty ) {
        timeFrame sortBy ( _.timestamp.desc ) take (newest.get) sortBy (_.timestamp.asc)
      } else if ( begin.isEmpty && end.isEmpty ){
        timeFrame sortBy ( _.timestamp.desc ) take 1
      } else {
        timeFrame
      }
    query
  }

  protected def betweenLogicR(
    begin: Option[Timestamp],
    end: Option[Timestamp]
  ): DBValuesTable => Rep[Boolean] =
    ( end, begin ) match {
      case (None, Some(startTime)) =>
        { value =>
          value.timestamp >= startTime
        }
      case (Some(endTime), None) =>
        { value =>
          value.timestamp <= endTime
        }
      case (Some(endTime), Some(startTime)) =>
        { value =>
          value.timestamp >= startTime &&
          value.timestamp <= endTime
        }
      case (None, None) =>
        { value =>
          true: Rep[Boolean]
        }
    }
  protected def betweenLogic(
    begin: Option[Timestamp],
    end: Option[Timestamp]
  ): DBValue => Boolean =
    ( end, begin ) match {
      case (None, Some(startTime)) =>
      { _.timestamp.getTime >= startTime.getTime}

      case (Some(endTime), None) =>
        { _.timestamp.getTime <= endTime.getTime }

      case (Some(endTime), Some(startTime)) =>
        { value =>
        value.timestamp.getTime >= startTime.getTime && value.timestamp.getTime <= endTime.getTime 
        }
      case (None, None) =>
        { value => true }
    }

    // NOTE: duplicate code: nBetweenLogicQ
    protected def takeLogic(
      newest: Option[Int],
      oldest: Option[Int],
      timeFrameEmpty: Boolean
    ): Seq[DBValue] => Seq[DBValue] = {
      if ( oldest.nonEmpty ) {
        _ sortBy ( _.timestamp.getTime ) take (oldest.get)
      } else if ( newest.nonEmpty ) {
        _.sortBy( _.timestamp.getTime )(Ordering.Long.reverse) take (newest.get) reverse
      } else if ( timeFrameEmpty ) {
        _.sortBy( _.timestamp.getTime )(Ordering.Long.reverse) take 1
      } else {
        _.sortBy( _.timestamp.getTime )
      }
    }


  /**
   * Used to get result values with given constrains in parallel if possible.
   * first the two optional timestamps, if both are given
   * search is targeted between these two times. If only start is given,all values from start time onwards are
   * targeted. Similiarly if only end is given, values before end time are targeted.
   *    Then the two Int values. Only one of these can be present. fromStart is used to select fromStart number
   * of values from the begining of the targeted area. Similiarly from ends selects fromEnd number of values from
   * the end.
   * All parameters except the first are optional, given only the first returns all requested data
   *
   * @param requests SINGLE requests in a list (leafs in request O-DF); InfoItems, Objects and MetaDatas
   * @param start optional start Timestamp
   * @param end optional end Timestamp
   * @param fromStart number of values to be returned from start
   * @param fromEnd number of values to be returned from end
   * @return Combined results in a O-DF tree
   */
  def getNBetween(
    requests: Iterable[HasPath],
    begin: Option[Timestamp],
    end: Option[Timestamp],
    newest: Option[Int],
    oldest: Option[Int]
  ): Option[OdfObjects] = {

    require( ! (newest.isDefined && oldest.isDefined),
      "Both newest and oldest at the same time not supported!")

    val requestsSeq = requests.toSeq

    require( requestsSeq.size >= 1,
      "getNBetween should be called with at least one request thing")

    def processObjectI(path: Path): DBIO[Option[OdfObjects]] = {
        getHierarchyNodeI(path) flatMap {
          case Some(rootNode) => for {
            subTreeData <- getSubTreeI(rootNode.path)

            // NOTE: We can only apply "between" logic here because of the subtree query
            // basicly we fetch too much data if "newest" or "oldest" is set
           
            timeframedTreeData =
              subTreeData filter {
                case (node, Some(value)) => betweenLogic(begin, end)(value)
                case (node, None) => true
              }

            dbInfoItems: DBInfoItems =
              toDBInfoItems(timeframedTreeData) mapValues takeLogic(newest, oldest, begin.isEmpty && end.isEmpty)

            results = odfConversion(dbInfoItems)

            } yield results

          case None =>  // Requested object was not found, TODO: think about error handling
            DBIO.successful(None)
        }

    }
    
    val allResults = requestsSeq.par map {

      case obj @ OdfObjects(objects,_) =>
        require(objects.isEmpty,
          s"getNBetween requires leaf OdfElements from the request, given nonEmpty $obj")

        runSync( processObjectI(obj.path) )


      case obj @ OdfObject(path,items,objects,_,_) =>
        require(items.isEmpty && objects.isEmpty,
          s"getNBetween requires leaf OdfElements from the request, given nonEmpty $obj")

        runSync( processObjectI(path) )

      case OdfInfoItem(path, rvalues, _, metadataQuery) =>

        val odfInfoItemI = getHierarchyNodeI(path) flatMap {nodeO =>

          nodeO match {
            case Some(node @ DBNode(Some(nodeId),_,_,_,_,_,_,true)) => for {


              odfInfoItem <-  processObjectI( path )
              
              metaData <- metadataQuery match {
                case Some(_) => getMetaDataI(nodeId)  // fetch metadata
                case None    => DBIO.successful(None)
              }

              metaInfoItem = OdfInfoItem(path, Iterable(), None, metaData) 
              result = odfInfoItem.map{
                infoItem => fromPath(infoItem) combine fromPath(metaInfoItem)
              }

            } yield result

            case n =>
              println(s"Requested '$path' as InfoItem, found '$n'")
              DBIO.successful(None)  // Requested object was not found or not infoitem, TODO: think about error handling
          }
        }

        runSync(odfInfoItemI)


      //case odf: OdfElement =>
      //  throw new RuntimeException(s"Non-supported query parameter: $odf")
        //case OdfObjects(_, _) =>
        //case OdfDesctription(_, _) =>
        //case OdfValue(_, _, _) =>
    }

    // Combine some Options
    allResults.fold(None){
      case (Some(results), Some(otherResults)) => Some(results combine otherResults)
      case (None, Some(results)) => Some(results)
      case (Some(results), None) => Some(results)
      case (None, None) => None
    }


  }



  /**
   * @param root Root of the tree
   * @param depth Maximum traverse depth relative to root
   */
  protected def getSubTreeQ(
    root: DBNode,
    depth: Option[Int] = None
  ): Query[(DBNodesTable, Rep[Option[DBValuesTable]]), (DBNode, Option[DBValue]), Seq] = {

    val depthConstraint: DBNodesTable => Rep[Boolean] = node =>
      depth match {
        case Some(depthLimit) =>
          node.depth <= root.depth + depthLimit
        case None =>
          true
      }
    val nodesQ = hierarchyNodes filter { node =>
      node.leftBoundary >= root.leftBoundary &&
      node.rightBoundary <= root.rightBoundary &&
      depthConstraint(node)
    }

    val nodesWithValuesQ =
      nodesQ joinLeft latestValues on (_.id === _.hierarchyId)

    nodesWithValuesQ sortBy (_._1.leftBoundary.asc)
  }


  protected def getSubTreeI(
    path: Path,
    depth: Option[Int] = None
  ): DBIOro[Seq[(DBNode, Option[DBValue])]] = {

    val subTreeRoot = getHierarchyNodeI(path)

    subTreeRoot flatMap {
      case Some(root) =>

        getSubTreeQ(root, depth).result

      case None => DBIO.successful(Seq()) // TODO: What if not found?
    }
  }



  /**
   * getAllSubs is used to search the database for subscription information
   * Can also filter subscriptions based on whether it has a callback address
   * @param hasCallBack optional boolean value to filter results based on having callback address
   *
   * None -> all subscriptions
   * Some(True) -> only with callback
   * Some(False) -> only without callback
   *
   * @return DBSub objects for the query as Seq
   */
  def getAllSubs(hasCallBack: Option[Boolean]): Seq[DBSub] = {
    val all = runSync(hasCallBack match{
      case Some(true)   => subs.filter(!_.callback.isEmpty).result
      case Some(false)  => subs.filter(_.callback.isEmpty).result
      case None         => subs.result
    })
    all.collect({case x: DBSub =>x})

  }


  def getSubscribtedPaths( subId: Int ): Seq[Path] = {
    val pathsQ = for{
      (subI, hie) <- subItems.filter( _.subId === subId ) join hierarchyNodes on ( _.hierarchyId === _.id )
    }yield( hie.path )
    runSync( pathsQ.result )
  }
  def getSubscribtedItems( subId: Int ): Seq[SubscriptionItem] = {
    val pathsQ = for{
      (subI, hie) <- subItems.filter( _.subId === subId ) join hierarchyNodes on ( _.hierarchyId === _.id )
    } yield (subI.subId, hie.path, subI.lastValue)
    runSync( pathsQ.result ) map SubscriptionItem.tupled
  }

  /**
   * Returns DBSub object wrapped in Option for given id.
   * Returns None if no subscription data matches the id
   * @param id number that was generated during saving
   *
   * @return returns Some(BDSub) if found element with given id None otherwise
   */
  def getSub(id: Int): Option[DBSub] = runSync(getSubI(id))


  protected def getInfoItemsI(hNodes: Seq[DBNode]): DBIO[DBInfoItems] = 
    dbioDBInfoItemsSum(
      hNodes map { hNode =>
        for {
          subTreeData <- getSubTreeI( hNode.path )

          infoItems: DBInfoItems = toDBInfoItems( subTreeData )

          result: DBInfoItems = infoItems collect {
            case (node, seqVals) if seqVals.nonEmpty =>
              ( node
              , seqVals sortBy ( _.timestamp.getTime ) take 1
              ) 
          } 
        } yield result
      } 
    )
}
