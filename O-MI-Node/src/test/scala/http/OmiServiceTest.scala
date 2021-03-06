package http

import java.net.InetAddress

import akka.http.scaladsl.marshallers.xml.ScalaXmlSupport.defaultNodeSeqUnmarshaller
import akka.http.scaladsl.model.MediaTypes._
import akka.http.scaladsl.model.RemoteAddress
import akka.http.scaladsl.model.StatusCodes._
import akka.http.scaladsl.model.headers.{RawHeader, `Remote-Address`}
import akka.http.scaladsl.testkit.Specs2RouteTest
import akka.pattern.ask
import akka.util.Timeout
import org.specs2.matcher.XmlMatchers
import org.specs2.mutable.Specification
import org.specs2.specification.BeforeAfterAll

import scala.concurrent.Await
import scala.concurrent.duration.DurationInt
import scala.xml._
import database._
import types.Path
import org.specs2.matcher.Expectable
import journal.LatestStore.ErasePathCommand


class OmiServiceTest
  extends Specification
    with XmlMatchers
    with Specs2RouteTest
    with BeforeAfterAll
    with testHelpers.TestOmiService
{

  val printer = new scala.xml.PrettyPrinter(80, 2)

  val localHost = RemoteAddress(InetAddress.getLoopbackAddress)

  "System tests for features of OMI Node service".title


  def beforeAll() = {
    OmiServer.saveSettingsOdf(system, requestHandler, settings) //Boot.init(dbConnection)
  }

  override def afterAll = {
    dbConnection.destroy()
    Await
      .ready((singleStores.hierarchyStore.?(ErasePathCommand(Path("Objects")))(new Timeout(5 seconds))),
        10 seconds)
    system.terminate()
    //XXX: DID NOT WORK
    //Await.ready(system.terminate(), 10 seconds)

  }

  def isXml = mediaType === `text/xml`
  def isOkXml = {
    isXml
    status === OK
  }
  def omiReturn(response: Expectable[xml.Node], code:String) = response must \("response") \("result") \("return", "returnCode" -> code)
  def omiReturn200(response: Expectable[xml.Node]) = omiReturn(response, "200")
  def omiReturn400(response: Expectable[xml.Node]) = omiReturn(response, "400")





  "Data discovery, GET: OmiService" >> {

    "respond with hello message for GET request to the root path" >> {
      Get() ~> myRoute ~> check {
        status === OK
        mediaType === `text/html`
        responseAs[String] must contain("Say hello to <i>O-MI Node service")

      }
    }

    "respond successfully to GET to /Objects" >> {
      Get("/Objects").withHeaders(`Remote-Address`(localHost)) ~> myRoute ~> check {
        isOkXml
        responseAs[NodeSeq].headOption must
          beSome.which(_.label == "Objects") // => ??? }((_: Node).label == "Objects")//.head.label === "Objects"
      }
    }
    "respond successfully to GET to /Objects/" >> {
      Get("/Objects/").withHeaders(`Remote-Address`(localHost)) ~> myRoute ~> check {
        isOkXml
        responseAs[NodeSeq].headOption must beSome.which(_.label == "Objects")
      }
    }
    "respond with error to non existing path" >> {
      Get("/Objects/nonexsistent7864057").withHeaders(`Remote-Address`(localHost)) ~> myRoute ~> check {
        isXml
        status === NotFound
        responseAs[NodeSeq].headOption must beSome.which(_.label == "error")
      }
    }
    val settingsPath = "/Objects/OMI-Service/Settings/"
    "respond successfully to GET to some value" >> {
      Get(settingsPath + "num-latest-values-stored/value").withHeaders(`Remote-Address`(localHost)) ~>
        myRoute ~>
        check {
          mediaType === `text/plain`
          status === OK
          responseAs[String] === "10"
        }

    }


    // Somewhat overcomplicated test; Serves as an example for other tests
    "reply its settings as odf frorm path `settingsOdfPath` (with \"Settings\" id)" >> {
      Get(settingsPath).withHeaders(`Remote-Address`(localHost)) ~>
        myRoute ~>
        check { // this didn't work without / at start
          isOkXml
          responseAs[NodeSeq] must \("id") \> "Settings"
        }
    }

    "reply its settings having num-latest-values-stored)" >> {
      Get(settingsPath).withHeaders(`Remote-Address`(localHost)) ~>
        myRoute ~>
        check { // this didn't work without / at start
          isOkXml
          responseAs[NodeSeq] must \("InfoItem", "name" -> "num-latest-values-stored")
        }
    }

  }

  "request, POST: OmiService" >> {
    "respond correctly to read request with invalid omi" >> {
      val request: NodeSeq =
      // NOTE: The type needed for compiler to recognize the right Marhshaller later
        <omiEnvelope xmlns="http://www.opengroup.org/xsd/omi/1.0/" version="1.0" ttl="10">
          <read msgformat="odf">
            <msgsssssssssssssssssssssssssss xmlns="http://www.opengroup.org/xsd/odf/1.0/">
              <Objects>
                <Object>
                  <id>SmartFridge22334411</id>
                  <InfoItem name="PowerConsumption"/>
                </Object>
              </Objects>
            </msgsssssssssssssssssssssssssss>
          </read>
        </omiEnvelope>

      Post("/", request).withHeaders(`Remote-Address`(localHost)) ~> myRoute ~> check {
        isOkXml
        val resp = responseAs[NodeSeq].head
        val response = resp showAs (n =>
          "Request:\n" + request + "\n\n" + "Response:\n" + printer.format(n))

        omiReturn400(response)
        val description = resp.\("response").\("result").\("return").\@("description")
        description must startWith("Schema error:")
      }
    }

    "respond correctly to read request with invalid odf" >> {
      val request: NodeSeq =
      // NOTE: The type needed for compiler to recognize the right Marhshaller later
        <omiEnvelope xmlns="http://www.opengroup.org/xsd/omi/1.0/" version="1.0" ttl="10">
          <read msgformat="odf">
            <msg>
              <Objects xmlns="http://www.opengroup.org/xsd/odf/1.0/">
                <Objects>
                  <id>SmartFridge22334411</id>
                  <InfoItem name="PowerConsumption"/>
                </Objects>
              </Objects>
            </msg>
          </read>
        </omiEnvelope>

      Post("/", request).withHeaders(`Remote-Address`(localHost)) ~> myRoute ~> check {
        isOkXml
        val resp = responseAs[NodeSeq].head
        val response = resp showAs (n =>
          "Request:\n" + request + "\n\n" + "Response:\n" + printer.format(n))


        omiReturn400(response)
        val description = resp.\("response").\("result").\("return").\@("description")
        description must startWith("Schema error:")
      }
    }

    "respond correctly to read request with non-existing path" >> {
      val request: NodeSeq =
      // NOTE: The type needed for compiler to recognize the right Marhshaller later
        <omiEnvelope xmlns="http://www.opengroup.org/xsd/omi/1.0/" version="1.0" ttl="10">
          <read msgformat="odf">
            <msg>
              <Objects xmlns="http://www.opengroup.org/xsd/odf/1.0/">
                <Object>
                  <id>non-existing</id>
                  <InfoItem name="PowerConsumption"/>
                </Object>
              </Objects>
            </msg>
          </read>
        </omiEnvelope>

      Post("/", request).withHeaders(`Remote-Address`(localHost)) ~> myRoute ~> check {
        isOkXml
        val resp = responseAs[NodeSeq].head
        val response = resp showAs (n =>
          "Request:\n" + request + "\n\n" + "Response:\n" + printer.format(n))


        val nf = omiReturn(response, "404")
        val description = resp.\("response").\("result").\("return").\@("description") ===
          "Some parts of O-DF not found. msg element contains missing O-DF structure."
        val id = resp must \("response").\("result").\("msg").\("Objects").\("Object").\("id").\>("non-existing")
        val name = resp must
          \("response").\("result").\("msg").\("Objects").\("Object").\("InfoItem", "name" -> "PowerConsumption")
        nf and description and id and name
      }

    }

    "respond correctly to subscription poll with non existing requestId" >> {
      val request: NodeSeq =
        <omiEnvelope xmlns="http://www.opengroup.org/xsd/omi/1.0/" version="1.0" ttl="10">
          <read>
            <requestID>9999</requestID>
          </read>
        </omiEnvelope>

      Post("/", request).withHeaders(`Remote-Address`(localHost)) ~> myRoute ~> check {
        isOkXml
        val resp = responseAs[NodeSeq].head
        val response = resp showAs (n =>
          "Request:\n" + request + "\n\n" + "Response:\n" + printer.format(n))


        val returnC = response must
          \("response") \
            ("result") \
            ("return", "returnCode" -> "404", "description" -> "Some requestIDs were not found.")
        val rID = response must \("response") \ ("result") \ ("requestID") \> ("9999")
        returnC and rID
      }
    }

    "respond to permissive requests" >> {
      val request: String =
        """
        <omiEnvelope xmlns="http://www.opengroup.org/xsd/omi/1.0/" version="1.0" ttl="0">
          <write msgformat="odf">
            <msg >
              <Objects xmlns="http://www.opengroup.org/xsd/odf/1.0/" >
                <Object>
                  <id>testObject</id>
                  <InfoItem name="testSensor">
                    <value unixTime="0" type="xs:integer">0</value>
                  </InfoItem>
                </Object>
              </Objects>
            </msg>
          </write>
        </omiEnvelope>"""

      "respond correctly to write request with whitelisted IPv4-addresses" >> {
        Post("/", XML.loadString(request)).withHeaders(`Remote-Address`(localHost)) ~> myRoute ~> check {
          isOkXml
          val resp = responseAs[NodeSeq].head
          val response = resp showAs (n =>
            "Request:\n" + request + "\n\n" + "Response:\n" + printer.format(n))

          omiReturn200(response)
        }

        Post("/", XML.loadString(request.replaceAll("testSensor", "testSensor1")))
          .withHeaders(`Remote-Address`(RemoteAddress(InetAddress.getByName("127.255.255.255")))) ~> myRoute ~> check {

          isOkXml
          val resp = responseAs[NodeSeq].head
          val response = resp showAs (n =>
            "Request:\n" + request + "\n\n" + "Response:\n" + printer.format(n))

          //println(printer.format(resp))

          omiReturn200(response)
        }
      }

      "respond correctly to write request with non-whitelisted IPv4-addresses" >> {
        Post("/", XML.loadString(request.replaceAll("testSensor", "testSensor2")))
          .withHeaders(`Remote-Address`(RemoteAddress(InetAddress.getByName("192.65.127.80")))) ~> myRoute ~> check {

          isOkXml
          val resp = responseAs[NodeSeq].head
          val response = resp showAs (n =>
            "Request:\n" + request + "\n\n" + "Response:\n" + printer.format(n))


          omiReturn(response, "401")
          val description = resp.\("response").\("result").\("return").\@("description")
          description startsWith ("Unauthorized")
        }

        Post("/", XML.loadString(request.replaceAll("testSensor", "testSensor3")))
          .withHeaders(`Remote-Address`(RemoteAddress(InetAddress.getByName("128.0.0.1")))) ~> myRoute ~> check {

          isOkXml
          val resp = responseAs[NodeSeq].head
          val response = resp showAs (n =>
            "Request:\n" + request + "\n\n" + "Response:\n" + printer.format(n))


          omiReturn(response, "401")
          val description = resp.\("response").\("result").\("return").\@("description")
          description startsWith ("Unauthorized")
        }

      }

      "respond correctly to write request with whitelisted IPv6-addresses" >> {
        Post("/", XML.loadString(request.replaceAll("testSensor", "testSensor4")))
          .withHeaders(`Remote-Address`(RemoteAddress(InetAddress.getByName("0:0:0:0:0:0:0:1")))) ~> myRoute ~> check {

          isOkXml
          val resp = responseAs[NodeSeq].head
          val response = resp showAs (n =>
            "Request:\n" + request + "\n\n" + "Response:\n" + printer.format(n))


          omiReturn200(response)
        }
        Post("/", XML.loadString(request.replaceAll("testSensor", "testSensor5")))
          .withHeaders(`Remote-Address`(RemoteAddress(InetAddress.getByName("0:0:0:FFFF:FFFF:FFFF:FFFF:FFFF")))) ~>
          myRoute ~>
          check {

            isOkXml
            val resp = responseAs[NodeSeq].head
            val response = resp showAs (n =>
              "Request:\n" + request + "\n\n" + "Response:\n" + printer.format(n))


            omiReturn200(response)
          }
      }
      "respond correctly to write request with non-whitelisted IPv6-addresses" >> {
        Post("/", XML.loadString(request.replaceAll("testSensor", "testSensor4")))
          .withHeaders(`Remote-Address`(RemoteAddress(InetAddress.getByName("0:0:1:0:0:0:0:0")))) ~> myRoute ~> check {

          isOkXml
          val resp = responseAs[NodeSeq].head
          val response = resp showAs (n =>
            "Request:\n" + request + "\n\n" + "Response:\n" + printer.format(n))

          //          println(printer.format(resp))

          omiReturn(response, "401")
          val description = resp.\("response").\("result").\("return").\@("description")
          description startsWith ("Unauthorized")
        }

        Post("/", XML.loadString(request.replaceAll("testSensor", "testSensor4")))
          .withHeaders(`Remote-Address`(RemoteAddress(InetAddress.getByName("2001:DB80:ABBA:BABB:A:0:FF:FF")))) ~>
          myRoute ~>
          check {

            isOkXml
            val resp = responseAs[NodeSeq].head
            val response = resp showAs (n =>
              "Request:\n" + request + "\n\n" + "Response:\n" + printer.format(n))

            omiReturn(response, "401")
            val description = resp.\("response").\("result").\("return").\@("description")
            description startsWith ("Unauthorized")
          }
      }
      "respond correctly to normal read with non-whitelisted address and user" >> {
        val request: String =
          """
          <omiEnvelope xmlns="http://www.opengroup.org/xsd/omi/1.0/" version="1.0" ttl="0">
            <read msgformat="odf">
              <msg>
                <Objects xmlns="http://www.opengroup.org/xsd/odf/1.0/">
                </Objects>
              </msg>
            </read>
          </omiEnvelope>"""
        Post("/", XML.loadString(request))
          .withHeaders(`Remote-Address`(RemoteAddress(InetAddress.getByName("192.65.127.80")))) ~> myRoute ~> check {

          isOkXml
          val resp = responseAs[NodeSeq].head
          val response = resp showAs (n =>
            "Request:\n" + request + "\n\n" + "Response:\n" + printer.format(n))

          omiReturn200(response)
          response must \("response") \ ("result") \ ("msg") \ ("Objects") \ ("Object")
        }
        Post("/", XML.loadString(request))
          .withHeaders(`Remote-Address`(RemoteAddress(InetAddress.getByName("187.42.74.1"))),
            RawHeader("HTTP_EPPN", "someNonExistentUser@cheatOrganization.zw")) ~> myRoute ~> check {

          isOkXml
          val resp = responseAs[NodeSeq].head
          val response = resp showAs (n =>
            "Request:\n" + request + "\n\n" + "Response:\n" + printer.format(n))

          omiReturn200(response)
          response must \("response") \ ("result") \ ("msg") \ ("Objects") \ ("Object")
        }
      }
      "respond correctly to write request with non-whitelisted user" >> {
        Post("/", XML.loadString(request.replaceAll("testSensor", "testSensor7")))
          .withHeaders(`Remote-Address`(RemoteAddress(InetAddress.getByName("192.65.127.80"))),
            RawHeader("HTTP_EPPN", "someNonExistentUser@cheatOrganization.zw")) ~> myRoute ~> check {

          isOkXml
          val resp = responseAs[NodeSeq].head
          val response = resp showAs (n =>
            "Request:\n" + request + "\n\n" + "Response:\n" + printer.format(n))

          omiReturn(response, "401")
          val description = resp.\("response").\("result").\("return").\@("description")
          description startsWith ("Unauthorized")
        }
      }
      "respond correctly to write request with whitelisted saml user" >> {
        Post("/", XML.loadString(request.replaceAll("testSensor", "testSensor8")))
          .withHeaders(`Remote-Address`(RemoteAddress(InetAddress.getByName("192.65.127.80"))),
            RawHeader("HTTP_EPPN", "myself@testshib.org")) ~> myRoute ~> check {

          isOkXml

          val resp = responseAs[NodeSeq].head
          val response = resp showAs (n =>
            "Request:\n" + request + "\n\n" + "Response:\n" + printer.format(n))

          omiReturn200(response)
        }
      }
    }
    "accept empty Object in write request (issue #8)" >> {
      val emptyObjWrite: String =
        """
        <omiEnvelope xmlns="http://www.opengroup.org/xsd/omi/1.0/" version="1.0" ttl="0">
          <write msgformat="odf">
            <msg >
              <Objects xmlns="http://www.opengroup.org/xsd/odf/1.0/" >
                <Object type="myEmptyObj">
                  <id>emptyObject</id>
                </Object>
              </Objects>
            </msg>
          </write>
        </omiEnvelope>"""

      Post("/", XML.loadString(emptyObjWrite)).withHeaders(`Remote-Address`(localHost)) ~> myRoute ~> check {
        isOkXml
        val resp = responseAs[NodeSeq].head
        val response = resp showAs (n =>
          "Request:\n" + emptyObjWrite + "\n\n" + "Response:\n" + printer.format(n))
        omiReturn200(response)
      }
      Get("/Objects/emptyObject") ~> myRoute ~> check {
        isOkXml
        val resp = responseAs[NodeSeq].head
        resp must \("id") \> "emptyObject"
        resp \@("type") === "myEmptyObj"
      }
    }

    /*
      * EXAMPLES:
      *
      * "return a greeting for GET requests to the root path" in {
      * Get() ~> myRoute ~> check {
      * responseAs[String] must contain("Say hello")
      * }
      * }
      *
      * "leave GET requests to other paths unhandled" in {
      * Get("/kermit") ~> myRoute ~> check {
      * handled must beFalse
      * }
      * }
      *
      * "return a MethodNotAllowed error for PUT requests to the root path" in {
      * Put() ~> sealRoute(myRoute) ~> check {
      * status === MethodNotAllowed
      * responseAs[String] === "HTTP method not allowed, supported methods: GET"
      * }
      * }
      */

  }
}

