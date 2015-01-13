package http

import akka.actor.{ActorSystem, Props}
import akka.io.IO
import spray.can.Http
import akka.pattern.ask
import akka.util.Timeout
import scala.concurrent.duration._
import java.util.Date;
import java.text.SimpleDateFormat;

import sensorDataStructure.{SensorMap,SensorData}
import responses._
import parsing._

object Boot extends App {

  // Create our in-memory sensor database

  val sensormap: SensorMap = new SensorMap("")

  sensormap.set("Objects", new SensorMap("Objects"))
  sensormap.set("Objects/Refrigerator123", new SensorMap("Objects/Refrigerator123"))
  sensormap.set("Objects/RoomSensors1", new SensorMap("Objects/RoomSensors1"))

  val date = new Date();
  val formatDate = new SimpleDateFormat ("yyyy-MM-dd'T'hh:mm:ss");
  val testData = Map(
    "Objects/Refrigerator123/PowerConsumption" -> "0.123",
    "Objects/Refrigerator123/RefrigeratorDoorOpenWarning" -> "door closed",
    "Objects/Refrigerator123/RefrigeratorProbeFault" -> "Nothing wrong with probe",
    "Objects/RoomSensors1/Temperature" -> "21.2",
    "Objects/RoomSensors1/CarbonDioxide" -> "too much"
    )
  for ((path, value) <- testData){
    sensormap.set(path, new SensorData(path, value, formatDate.format(date)))
  }


  // we need an ActorSystem to host our application in
  implicit val system = ActorSystem("on-spray-can")

  // create and start our service actor
  val service = system.actorOf(Props(new OmiServiceActor(sensormap)), "omi-service")

  implicit val timeout = Timeout(5.seconds)

  // start a new HTTP server on port 8080 with our service actor as the handler
  IO(Http) ? Http.Bind(service, interface = "0.0.0.0", port = 8080)
}
