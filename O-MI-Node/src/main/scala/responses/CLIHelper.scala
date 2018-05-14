

/*+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 +    Copyright (c) 2015 Aalto University.                                        +
 +                                                                                +
 +    Licensed under the 4-clause BSD (the "License");                            +
 +    you may not use this file except in compliance with the License.            +
 +    You may obtain a copy of the License at top most directory of project.      +
 +                                                                                +
 +    Unless required by applicable law or agreed to in writing, software         +
 +    distributed under the License is distributed on an "AS IS" BASIS,           +
 +    WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.    +
 +    See the License for the specific language governing permissions and         +
 +    limitations under the License.                                              +
 +++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++*/

package responses
import scala.concurrent.ExecutionContext.Implicits.global
import scala.concurrent.Future
import scala.util.{Failure, Success}
import akka.event.{LogSource, Logging, LoggingAdapter}
import akka.actor.ActorSystem
import database._
import types.odf._
import types._
import http.{ActorSystemContext, OmiServer}

trait CLIHelperT{
  def handlePathRemove(parentPathS: Seq[Path]): Future[Seq[Int]]
  def getAllData(): Future[Option[ODF]]
  def writeOdf(odf: ImmutableODF): Unit
  }
class CLIHelper(val singleStores: SingleStores, dbConnection: DB )(implicit system: ActorSystem) extends CLIHelperT{

  implicit val logSource: LogSource[CLIHelper]= new LogSource[CLIHelper] {
      def genString( handler:  CLIHelper): String = handler.toString
    }
  protected val log: LoggingAdapter = Logging( system, this)

  def handlePathRemove(parentPaths: Seq[Path]): Future[Seq[Int]] = {
    val odf = singleStores.hierarchyStore execute GetTree()
    Future.sequence(parentPaths.map { parentPath =>
      val nodeO = odf.get(parentPath)
      nodeO match {
        case Some(node) => {

          val leafs = odf.getPaths.filter {
            p: Path =>
              node.path.isAncestorOf(p)
          }

          singleStores.hierarchyStore execute TreeRemovePath(parentPath)

          leafs.foreach { path =>
            log.info(s"removing $path")
            singleStores.latestStore execute EraseSensorData(path)
          }

          val dbRemoveFuture: Future[Int] = dbConnection.remove(parentPath).map(_.length)

          dbRemoveFuture.onComplete {
            case Success(res) => log.info(s"Database successfully deleted $res nodes")
            case Failure(error) => log.error(error, s"Failure when trying to remove $parentPath")
          }

          dbRemoveFuture

        }
        case None => Future.successful(0)
      }
    })
  }



  /**
    * method of getting all the data available from hierarchystore and dagabase, includes all metadata and descriptions
    *
    * method in this class because it has viisbility to singleStores and Database
    * @return
    */
  def getAllData(): Future[Option[ODF]] = {
    val odf: ODF = singleStores.hierarchyStore execute GetTree()
    val leafs = odf.getLeafs
    dbConnection.getNBetween(leafs,None,None,Some(100),None).map{
      o : Option[ODF]=>
      o.map(_.union(odf))
    }
  }

  def writeOdf(odf: ImmutableODF): Unit = {
    val infoItems: Seq[InfoItem] = odf.getInfoItems
    dbConnection.writeMany(infoItems)
    singleStores.hierarchyStore execute Union(odf.immutable)
    val latestValues: Seq[(Path, Value[Any])] =
      infoItems.collect{
        case ii: InfoItem if ii.values.nonEmpty => (ii.path, ii.values.maxBy(_.timestamp.getTime()))
      }
    latestValues.foreach(pv => singleStores.latestStore execute SetSensorData(pv._1,pv._2))

  }

}

