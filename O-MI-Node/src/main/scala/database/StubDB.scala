package database

import java.sql.Timestamp
import java.util.Date

import akka.actor.{ActorRef, ActorSystem}
import akka.util.Timeout
import http.OmiConfigExtension
import org.slf4j.{Logger, LoggerFactory}
import types.OmiTypes.{OmiReturn, ReturnCode}
import types.Path
import types.odf._
import utils._

import scala.concurrent.Future

class StubDB(val singleStores: SingleStores, val system: ActorSystem, val settings: OmiConfigExtension) extends DB {

  import scala.concurrent.ExecutionContext.Implicits.global
  protected val log: Logger = LoggerFactory.getLogger("Stub DB")

  def initialize(): Unit = Unit

  val dbmaintainer: ActorRef = system.actorOf(SingleStoresMaintainer.props(singleStores, settings))


  /**
    * Used to get result values with given constrains in parallel if possible.
    * first the two optional timestamps, if both are given
    * search is targeted between these two times. If only start is given,all values from start time onwards are
    * targeted. Similarly if only end is given, values before end time are targeted.
    * Then the two Int values. Only one of these can be present. fromStart is used to select fromStart number
    * of values from the beginning of the targeted area. Similarly from ends selects fromEnd number of values from
    * the end.
    * All parameters except the first are optional, given only the first returns all requested data
    *
    * @param requests SINGLE requests in a list (leafs in request O-DF); InfoItems, Objects and MetaDatas
    * @param begin    optional start Timestamp
    * @param end      optional end Timestamp
    * @param newest   number of values to be returned from start
    * @param oldest   number of values to be returned from end
    * @return Combined results in a O-DF tree
    */
  def getNBetween(requests: Iterable[Node],
                  begin: Option[Timestamp],
                  end: Option[Timestamp],
                  newest: Option[Int],
                  oldest: Option[Int])(implicit timeout: Timeout): Future[Option[ODF]] = {
    readLatestFromCache(requests.map {
      node => node.path
    }.toSeq).map(Some(_))
  }

  def readLatestFromCache(requestedOdf: ODF): Future[ImmutableODF] = {
    readLatestFromCache(requestedOdf.getLeafPaths.toSeq)
  }

  def currentTimestamp = new Timestamp( new Date().getTime)
  def readLatestFromCache(leafPaths: Seq[Path]): Future[ImmutableODF] = {
    val timer = LapTimer(log.info)
    val fp2iis: Future[Set[Path]] = singleStores.getHierarchyTree().map{
      hTree => 
        timer.step("Got HT ODF")
        val stp = hTree.subTreePaths(leafPaths.toSet)
        timer.step("HT ODF STP")
        stp
    }

    val objectsWithValues: Future[ImmutableODF] = for {
      p2iis: Set[Path] <- fp2iis
      pathToValue  <-
        singleStores.readValues(p2iis.toSeq)
      objectsWithValues = ImmutableODF.createFromNodes(pathToValue.map(pv => InfoItem(pv._1,Vector(pv._2))))
    } yield objectsWithValues

    objectsWithValues.foreach{
      t => timer.step("objectsWithValues")
    }
    objectsWithValues
  }

  /**
    * Used to set many values efficiently to the database.
    *
    * @param data list item to be added consisting of Path and OdfValue[Any] tuples.
    */
  def writeMany(data: Seq[InfoItem]): Future[OmiReturn] = {
    Future.successful(OmiReturn.apply(ReturnCode.Success))
  }

  /**
    * Used to remove given path and all its descendants from the database.
    *
    * @param path Parent path to be removed.
    */
  def remove(path: Path)(implicit timeout: Timeout): Future[Seq[Int]] = Future.successful(Seq())
}
