
package responses

import parsing.xmlGen.xmlTypes.RequestResultType

import scala.concurrent.{ Future, Await, ExecutionContext, TimeoutException, Promise }
import agentSystem.{SuccessfulWrite, ResponsibleAgentResponse, PromiseWrite, PromiseResult }
import scala.util.{ Try, Success, Failure }
import scala.concurrent.duration._
import scala.concurrent.ExecutionContext.Implicits.global
import scala.collection.JavaConversions.iterableAsScalaIterable
import scala.collection.JavaConversions.asJavaIterable
//import scala.collection.JavaConverters._ //JavaConverters provide explicit conversion methods
//import scala.collection.JavaConversions.asJavaIterator
import scala.collection.breakOut
import scala.xml.{ NodeSeq, XML }
//import spray.http.StatusCode

import akka.actor.{ Actor, ActorLogging, ActorRef }
import akka.util.Timeout
import akka.pattern.ask


import types._
import OmiTypes._
import OdfTypes._
import OmiGenerator._
import parsing.xmlGen.{ xmlTypes, scalaxb, defaultScope }
import CallbackHandlers._
import database._

trait ResponseHandler extends OmiRequestHandler{
  def agentSystem : ActorRef
  handler{
    case response: ResponseRequest => handleResponse(response)
  }
  /** Method for handling ResponseRequest.
    * @param response request
    * @return (xml response, HTTP status code)
    */
  def handleResponse( response: ResponseRequest ) : Future[NodeSeq] ={
    val ttl = handleTTL(response.ttl)
    val resultFuture = Future.sequence(response.results.map{ result =>
      result.odf match {
        case Some(odf) =>

        val promiseResult = PromiseResult()
        val write = WriteRequest( ttl, odf)
        agentSystem ! PromiseWrite(promiseResult, write)
        val successF = promiseResult.isSuccessful
        successF.recoverWith{
          case e =>{
            log.error(e, "Failure when writing")
            Future.failed(e)
          }}

          val response = successF.map{
            succ => Results.success 
          }
          response
          case None => //noop?
          Future.successful(Results.success)
        }
      }.toSeq
    )

  resultFuture.map(results =>
    xmlFromResults(
      1.0,
      results:_*
    )
)

  }
}