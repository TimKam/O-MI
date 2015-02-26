package responses

import org.specs2.mutable._
import scala.io.Source
import responses._
import parsing._
import parsing.Types._
import parsing.Types.Path._
import database._
import parsing.OdfParser._
import java.util.Date;
import java.util.Calendar;
import java.text.SimpleDateFormat;
import scala.xml.Utility.trim
import scala.xml.XML

class CancelTest extends Specification with Before {
  def before = {
    val calendar = Calendar.getInstance()
    calendar.setTime(new Date(1421775723))
    calendar.set(Calendar.HOUR_OF_DAY, 12)
    val date = calendar.getTime
    val testtime = new java.sql.Timestamp(date.getTime)
    SQLite.clearDB()
    val testData = Map(
      Path("Objects/CancelTest/Refrigerator123/PowerConsumption") -> "0.123",
      Path("Objects/ReadTest/Refrigerator123/RefrigeratorDoorOpenWarning") -> "door closed",
      Path("Objects/ReadTest/Refrigerator123/RefrigeratorProbeFault") -> "Nothing wrong with probe",
      Path("Objects/ReadTest/RoomSensors1/Temperature/Inside") -> "21.2",
      Path("Objects/ReadTest/RoomSensors1/CarbonDioxide") -> "too much",
      Path("Objects/ReadTest/RoomSensors1/Temperature/Outside") -> "12.2",
      Path("Objects/ReadTest/SmartCar/Fuel") -> "30")

    val singleSubs = Array(
      Path("Objects/CancelTest/Refrigerator123/PowerConsumption"),
      Path("Objects/ReadTest/Refrigerator123/RefrigeratorDoorOpenWarning"),
      Path("Objects/ReadTest/Refrigerator123/RefrigeratorProbeFault"))

    val multiSubs = Array(
      singleSubs,
      Array(
        Path("Objects/ReadTest/RoomSensors1/Temperature/Inside"),
        Path("Objects/ReadTest/RoomSensors1/CarbonDioxide"),
        Path("Objects/ReadTest/RoomSensors1/Temperature/Outside")))

    for ((path, value) <- testData) {
      SQLite.remove(path)
      SQLite.set(new DBSensor(path, value, testtime))
    }

    // IDs [0-2]
    for (path <- singleSubs) {
      SQLite.saveSub(new DBSub(Array(path), 0, 1, None, Some(testtime)))
    }

    // IDs [3-4]
    for (paths <- multiSubs) {
      SQLite.saveSub(new DBSub(paths, 0, 1, None, Some(testtime)))
    }
  }

  "Cancel response" should {
    sequential
    "Give correct XML when a single cancel is requested" in {
      lazy val simpletestfile = Source.fromFile("src/test/resources/responses/cancel/SimpleXMLCancelRequest.xml").getLines.mkString("\n")
      lazy val correctxmlreturn = XML.loadFile("src/test/resources/responses/cancel/SimpleXMLCancelReturn.xml")
      val parserlist = OmiParser.parse(simpletestfile)
      val resultXML = trim(OMICancel.OMICancelResponse(parserlist))

      resultXML should be equalTo (trim(correctxmlreturn))
      OmiParser.parse(resultXML.toString()).head should beAnInstanceOf[Result]
    }

    "Give correct XML when a cancel with multiple ids are requested" in {
      lazy val simpletestfile = Source.fromFile("src/test/resources/responses/cancel/MultipleCancelRequest.xml").getLines.mkString("\n")
      lazy val correctxmlreturn = XML.loadFile("src/test/resources/responses/cancel/MultipleCancelReturn.xml")
      val parserlist = OmiParser.parse(simpletestfile)
      val resultXML = trim(OMICancel.OMICancelResponse(parserlist))

      resultXML should be equalTo (trim(correctxmlreturn))
      OmiParser.parse(resultXML.toString()).head should beAnInstanceOf[Result]
    }

    "Give correct XML when cancels with multiple paths is requested (multiple ids)" in {
      lazy val simpletestfile = Source.fromFile("src/test/resources/responses/cancel/MultiplePathsRequest.xml").getLines.mkString("\n")
      lazy val correctxmlreturn = XML.loadFile("src/test/resources/responses/cancel/MultiplePathsReturn.xml")
      val parserlist = OmiParser.parse(simpletestfile)
      val resultXML = trim(OMICancel.OMICancelResponse(parserlist))

      resultXML should be equalTo (trim(correctxmlreturn))
      OmiParser.parse(resultXML.toString()).head should beAnInstanceOf[Result]
    }

    "Give error XML when cancel is requested with non-existing id" in {
      lazy val simpletestfile = Source.fromFile("src/test/resources/responses/cancel/ErrorCancelRequest.xml").getLines.mkString("\n")
      lazy val correctxmlreturn = XML.loadFile("src/test/resources/responses/cancel/ErrorCancelReturn.xml")
      val parserlist = OmiParser.parse(simpletestfile)
      val resultXML = trim(OMICancel.OMICancelResponse(parserlist))

      resultXML should be equalTo (trim(correctxmlreturn))
      OmiParser.parse(resultXML.toString()).head should beAnInstanceOf[Result]
    }

    "Give correct XML when valid and invalid ids are mixed in cancel request" in {
      lazy val simpletestfile = Source.fromFile("src/test/resources/responses/cancel/MixedCancelRequest.xml").getLines.mkString("\n")
      lazy val correctxmlreturn = XML.loadFile("src/test/resources/responses/cancel/MixedCancelReturn.xml")
      val parserlist = OmiParser.parse(simpletestfile)
      val resultXML = trim(OMICancel.OMICancelResponse(parserlist))

      resultXML should be equalTo (trim(correctxmlreturn))
      OmiParser.parse(resultXML.toString()).head should beAnInstanceOf[Result]
    }
  }
}
