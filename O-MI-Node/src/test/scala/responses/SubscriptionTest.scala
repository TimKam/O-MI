package responses

import agentSystem.AgentSystem
import akka.pattern.ask
import akka.stream.ActorMaterializer
import akka.util.Timeout
import org.specs2.matcher.XmlMatchers._
import org.specs2.mutable._
import org.specs2.specification.BeforeAfterAll
import testHelpers.Actorstest
import types.OdfTypes.{OdfInfoItem, OdfValue}
import types.odf.ImmutableODF

import scala.concurrent.Await
import scala.util.Try

//import responses.Common._
import java.sql.Timestamp
import java.util.{Calendar, TimeZone}

import database._
import journal.LatestStore.ErasePathCommand
import journal.HierarchyStore.GetTree
import http.OmiConfig
import http.RequestStore
import types.OdfTypes._
import types.OmiTypes._
import types._
import types.odf.{NewTypeConverter, OldTypeConverter}

import scala.concurrent.duration._

// For eclipse:


/*
case class SubscriptionRequest(
  ttl: Duration,
  interval: Duration,
  odf: OdfObjects ,
  newest: Option[ Int ] = None,
  oldest: Option[ Int ] = None,
  callback: Option[ String ] = None
) extends OmiRequest with SubLike with OdfRequest

 */
class SubscriptionTest extends Specification with BeforeAfterAll {
  implicit val system = testHelpers.Actorstest.createAs()
  implicit val materializer: ActorMaterializer = ActorMaterializer()(system)
  implicit val settings = OmiConfig(system)
  implicit val callbackHandler: CallbackHandler = new CallbackHandler(settings)(system, materializer)
  val analytics = None

  implicit val singleStores = SingleStores(settings)
  implicit val dbConnection: TestDB = new TestDB("subscription-test-db")(
    system,
    singleStores,
    settings
  )

  val subscriptionManager = system.actorOf(
    SubscriptionManager.props(
      settings,
      singleStores,
      callbackHandler
    ), "subscription-handler"
  )
  val dbHandler = system.actorOf(
    DBHandler.props(
      dbConnection,
      singleStores,
      callbackHandler,
      new CLIHelper(singleStores, dbConnection)
    ),
    "database-handler"
  )
  lazy val requestStore =system.actorOf(
    RequestStore.props
  )
  val requestHandler = system.actorOf(
    RequestHandler.props(
      singleStores,
      subscriptionManager,
      dbHandler,
      settings,
      requestStore
    ),
    "RequestHandler"
  )
  val agentSystem = system.actorOf(
    AgentSystem.props(
      dbHandler,
      requestHandler,
      settings
    ),
    "agent-system-test"
  )

  val calendar = Calendar.getInstance()
  // try to fix bug with travis
  val timeZone = TimeZone.getTimeZone("Etc/GMT+2")
  calendar.setTimeZone(timeZone)
  val date = calendar.getTime
  val testtime = new java.sql.Timestamp(date.getTime)

  def pollValues(subIdO: Option[Long]): Vector[OdfValue[Any]] = subIdO.flatMap {
    subId =>
      pollSub(subId).results.headOption.flatMap {
        result =>
          result.odf.map {
            objects =>
              getInfoItems(NewTypeConverter.convertODF(objects)).flatMap {
                info => info.values
              }
          }
      }
  }.toVector.flatten

  def beforeAll = {
    //comment line below for detailed debug information
    //system.eventStream.publish(Mute(EventFilter.debug(), EventFilter.info(), EventFilter.warning()))
    initDB()

    //SingleStores.hierarchyStore execute TreeRemovePath(types.Path("/Objects"))
  }

  def afterAll = {
    //system.eventStream.publish(UnMute(EventFilter.debug(),EventFilter.info(), EventFilter.warning()))
    cleanAndShutdown()
    Await
      .ready((singleStores.hierarchyStore ? ErasePathCommand(types.Path("Objects"))) (new Timeout(5 seconds)),
        10 seconds)
  }

  /////////////////////////////////////////////////////////////////////////////

  "SubscriptionHandler" should {
    /* "return code 200 for successful subscription" >> {
       val (_, code) = addSub(1,5, Seq("p","1"))

       code === 200
     }*/

    "return random positive integer as id for new subscription" >> {
      val ns1 = addSub(1, 5, Seq(Path("p", "1")))
      val ns2 = addSub(1, 5, Seq(Path("p", "1")))
      val ns3 = addSub(1, 5, Seq(Path("p", "1")))
      val ns4 = addSub(1, 5, Seq(Path("p", "1")))
      val ns5 = addSub(1, 5, Seq(Path("p", "1")))
      val ns6 = addSub(1, 5, Seq(Path("p", "1")))
      val ns7 = addSub(1, 5, Seq(Path("p", "1")))
      val ns8 = addSub(1, 5, Seq(Path("p", "1")))
      val ns9 = addSub(1, 5, Seq(Path("p", "1")))
      val ns10 = addSub(1, 5, Seq(Path("p", "1")))
      val ns11 = addSub(1, 5, Seq(Path("p", "1")))
      val ns12 = addSub(1, 5, Seq(Path("p", "1")))
      val ns13 = addSub(1, 5, Seq(Path("p", "1")))
      val ns14 = addSub(1, 5, Seq(Path("p", "1")))
      val ns15 = addSub(1, 5, Seq(Path("p", "1")))
      val ns16 = addSub(1, 5, Seq(Path("p", "1")))
      val rIDs = Vector(ns1, ns2, ns3, ns4, ns5, ns6, ns7, ns8, ns9, ns10, ns11, ns12, ns13, ns14, ns15, ns16)
        .flatMap { n => n.results.headOption }.flatMap { result => result.requestIDs.headOption }
      val check = rIDs.foldLeft(0l must be_<(1l)) { case (l, r) => l and ((r must beBetween(0L, Int.MaxValue))) }
      rIDs must be size (16) and check
    }

    "fail when trying to use invalid interval" in new Actorstest {
      //val actor = system.actorOf(Props(new SubscriptionHandler))

      val dur = -5
      val res = Try {
        addSub(1, dur, Seq(Path("p", "1")))
      }

      //this failure actually comes from the construction of SubscriptionRequest class
      //invalid intervals are handled already in the parsing procedure

      //TODO: Check reason of failure. 
      //withThrowable couses compiler to fail on assertion error. See
      //testHelpers.scala for more information and seperate test case.
      res must
        beFailedTry //.withThrowable[java.lang.IllegalArgumentException](s"requirement failed: Invalid interval: $dur seconds")
    }


    "be able to handle multiple event subscriptions on the same path" >> {
      val sub1Id = addSub(5, -1, Seq(Path("p", "2")))
      val sub2Id = addSub(5, -1, Seq(Path("p", "2")))
      val sub3Id = addSub(5, -1, Seq(Path("p", "1")))

      def pollIds: Vector[Vector[OdfValue[Any]]] = for {
        response <- Vector(sub1Id, sub2Id, sub3Id)

        vectorResult <- (for {
          result <- response.results.headOption

          rID <- result.requestIDs.headOption

          response = pollSub(rID)

          result <- response.results.headOption
          objects <- result.odf
        } yield getInfoItems(NewTypeConverter.convertODF(objects)) flatMap { info => info.values }
          ).toVector

      } yield vectorResult

      val pollsBefore = pollIds
      val emptyCheck = pollsBefore.foldLeft(Vector.empty must have size (0)) { case (l, r) => l and (r must be empty) }

      addValue(Path("p", "2"), nv("1", 10000))
      addValue(Path("p", "2"), nv("2", 20000))
      addValue(Path("p", "2"), nv("3", 30000))
      val pollsAfter = pollIds
      val sizes = pollsAfter.map { values => values.size }
      val sizeCheck = sizes must contain(3, 3, 0)
      emptyCheck and sizeCheck
    }

    "return no values for interval subscriptions if the interval has not passed" >> {
      val subIdO: Option[Long] = addSub(5, 4, Seq(Path("p", "1"))).results.headOption
        .flatMap { result => result.requestIDs.headOption }

      Thread.sleep(2000)
      val values: Vector[OdfValue[Any]] = pollValues(subIdO)
      values must have size (0)
    }


    "be able to 'remember' last poll time to correctly return values for intervalsubs" >> {
      val subIdO: Option[Long] = addSub(5, 4, Seq(Path("p", "1"))).results.headOption
        .flatMap { result => result.requestIDs.headOption }

      Thread.sleep(2000)
      val valuesEmpty: Vector[OdfValue[Any]] = pollValues(subIdO)
      val emptyCheck = valuesEmpty must have size (0)
      Thread.sleep(2000)
      val values: Vector[OdfValue[Any]] = pollValues(subIdO)
      val sizeCheck = values must have size (1)
      emptyCheck and sizeCheck
    }

    "return copy of previous value for interval subs if previous value exists" >> {
      addValue(Path("p", "3"), nv("4"))

      val subIdO: Option[Long] = addSub(5, 1, Seq(Path("p", "3"))).results.headOption
        .flatMap { result => result.requestIDs.headOption }

      Thread.sleep(2000)
      val values1: Vector[OdfValue[Any]] = pollValues(subIdO)
      val sizeCheck1 = values1 must have size (2)
      Thread.sleep(2000)
      val values2: Vector[OdfValue[Any]] = pollValues(subIdO)
      val sizeCheck2 = values2 must have size (2)
      sizeCheck1 and sizeCheck2

    }

    "return failure notification with correct structure when polling a nonexistent subscription" >> {
      val id = 5000
      val returnMsg = pollSub(id).asXML

      returnMsg must \("response") \ ("result") \ ("return",
                                                    "returnCode" -> "404",
                                                    "description" -> s"Some requestIDs were not found.")
      returnMsg must \("response") \ ("result") \ ("requestID") \> s"$id"

    }

    //This test was skipped for duration, but seems to pass just fine.
    "return no new values for event subscription if there are no new events" >> {
      val subIdO: Option[Long] = addSub(5, -1, Seq(Path("r", "1"))).results.headOption
        .flatMap { result => result.requestIDs.headOption }
      pollValues(subIdO) must be empty
    }

    "return value for event sub when the value changes and return no values after polling" >> {
      val subIdO: Option[Long] = addSub(5, -1, Seq(Path("r", "1"))).results.headOption
        .flatMap { result => result.requestIDs.headOption }
      addValue(Path("r", "1"), nv("2", 10000))
      val c1 = pollValues(subIdO) must have size (1)
      addValue(Path("r", "1"), nv("3", 20000))
      val c2 = pollValues(subIdO) must have size (1)
      val c3 = pollValues(subIdO) must have size (0)
      c1 and c2 and c3
    }

    "return no new value for event sub if the value is same as the old one" >> {
      val subIdO: Option[Long] = addSub(5, -1, Seq(Path("r", "2"))).results.headOption
        .flatMap { result => result.requestIDs.headOption }

      addValue(Path("r", "2"), nv("0", 20000))
      val c1 = pollValues(subIdO) must have size (1)

      addValue(Path("r", "2"), nv("0", 22000))
      addValue(Path("r", "2"), nv("0", 23000))
      val c2 = pollValues(subIdO) must have size (0)
      val c3 = pollValues(subIdO) must have size (0)
      c1 and c2 and c3
    }

    "return only events for new infoitems and objects for interval -2 subscriptions" >> {
      val subId0: Option[Long] = addSubForObject(5, -2, "p").results.headOption
        .flatMap { result => result.requestIDs.headOption }
      addValue(Path("p", "1"), nv("5", 40000)) //existing paths
      addValue(Path("p", "2"), nv("5", 40000)) //existing paths
      addValue(Path("p", "3"), nv("5", 40000))
      //existing paths
      val c1 = pollValues(subId0) must have size (0)
      addValue(Path("p", "4"), nv("5", 40000)) //correct path 1
      addValue(Path("p", "s", "5"), nv("5", 40000)) //correct path 2
      addValue(Path("r", "5"), nv("5", 40000)) //wrong path
      addValue(Path("r", "2"), nv("5", 40000))
      //wrong path
      val c2 = pollValues(subId0) must have size (2)
      c1 and c2
    }

    "subscription should be removed when the ttl expired" >> {
      val subId = addSub(1, 5, Seq(Path("p", "1"))).asXML.\\("requestID").text.toInt
      Thread.sleep(100)
      pollSub(subId).asXML must \("response") \ ("result") \ ("return", "returnCode" -> "200")
      Thread.sleep(2000)
      pollSub(subId).asXML must \("response") \ ("result") \ ("return", "returnCode" -> "404")
    }
  }

  def initDB() = {
    //pathPrefix
    //val pp = Path("Objects", "SubscriptionTest")
    val pathAndvalues: Iterable[(Path, Vector[OdfValue[Any]])] = Seq(
      (Path("p", "1"), nv("1")),
      (Path("p", "2"), nv("2")),
      (Path("p", "3"), nv("3")),
      (Path("r", "1"), nv("0")),
      (Path("r", "2"), nv("0")),
      (Path("r", "3"), nv("0")),
      (Path("u", "7"), nv("0"))
    )

    pathAndvalues
      .foreach { case (path, values) => addValue(path, values) } //InputPusher.handlePathValuePairs(pathAndvalues)
  }

  def addSub(ttl: Long, interval: Long, paths: Seq[Path], callback: String = "") = {
    val basePath = Path("Objects", "SubscriptionTest")
    val odfF = (singleStores.hierarchyStore ? GetTree) (new Timeout(2 minutes)).mapTo[ImmutableODF]
    val hTree: ImmutableODF = Await.result(odfF, Duration.Inf)
    val p = hTree.selectSubTree(paths.map(basePath / _).toSet)
    val req = SubscriptionRequest(interval seconds, p, None, None, None, ttl seconds)
    implicit val timeout: Timeout = req.handleTTL
    Await.result((requestHandler ? req).mapTo[ResponseRequest], Duration.Inf)
  }


  def addSubForObject(ttl: Long, interval: Long, path: String, callback: String = "") = {
    val pp = Path("Objects", "SubscriptionTest")
    val odf = OdfTypes.createAncestors(OdfObject(OdfTreeCollection(OdfQlmID(path)), pp / path))
    val req = SubscriptionRequest(interval seconds,
      OldTypeConverter.convertOdfObjects(odf),
      None,
      None,
      None,
      ttl seconds)
    implicit val timeout: Timeout = req.handleTTL
    Await.result((requestHandler ? req).mapTo[ResponseRequest], Duration.Inf)
  }

  def pollSub(id: Long) = {
    val req = PollRequest(None, Vector(id))
    implicit val timeout: Timeout = req.handleTTL
    Await.result((requestHandler ? req).mapTo[ResponseRequest], Duration.Inf)
  }

  def cleanAndShutdown() = {
    Await.ready(system.terminate(), 2 seconds)
    dbConnection.destroy()

  }

  //add new value easily
  def addValue(path: Path, nv: Vector[OdfValue[Any]]): Unit = {
    val pp = Path("Objects", "SubscriptionTest")
    val odf = OdfTypes.createAncestors(OdfInfoItem(pp / path, nv))
    val writeReq = WriteRequest(OldTypeConverter.convertOdfObjects(odf))
    implicit val timeout = Timeout(10 seconds)
    val future = requestHandler ? writeReq
    Await.ready(future, 10 seconds) // InputPusher.handlePathValuePairs(Seq((pp / path, nv)))
  }

  //create new odfValue value easily
  def nv(value: String, timestamp: Long = 0L): Vector[OdfValue[Any]] = {
    Vector(OdfValue(
      value,
      "",
      new Timestamp(testtime.getTime + timestamp)
    ))
  }

}
