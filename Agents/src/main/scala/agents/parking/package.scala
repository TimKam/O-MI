package agents

import java.sql.Timestamp
import java.util.Date

import types._
import types.odf._

package object parking{
  def currentTimestamp: Timestamp = new Timestamp( new Date().getTime())
  def getStringOption(name: String, path: Path, odf: ImmutableODF): Option[String] = {
    odf.get( path / name ).flatMap{
      case ii:InfoItem =>
        ii.values.map{
          case sv: StringValue => sv.value
          case sv: StringPresentedValue => sv.value
          case v: Value[Any] => v.value.toString
        }.headOption
      case ii:Node =>
        throw MVError( s"$name should be an InfoItem.")
    }
  }
  def getLongOption(name: String, path: Path, odf: ImmutableODF): Option[Long] = {
    odf.get( path / name ).flatMap{
      case ii:InfoItem =>
        ii.values.collectFirst {
          case value: ShortValue =>
            value.value.toLong
          case value: IntValue =>
            value.value.toLong
          case value: LongValue =>
            value.value
        }
      case ii:Node =>
        throw MVError( s"$name should be an InfoItem.")
    }
  }
  def getDoubleOption(name: String, path: Path, odf: ImmutableODF): Option[Double] = {
    odf.get( path / name ).flatMap{
      case ii:InfoItem =>
        ii.values.collectFirst {
          case value: FloatValue =>
            value.value.toDouble
          case value: DoubleValue =>
            value.value
        }
      case ii:Node =>
        throw MVError( s"$name should be an InfoItem.")
    }
  }
  def getBooleanOption(name: String, path: Path, odf: ImmutableODF): Option[Boolean] = {
    odf.get( path / name ).flatMap{
      case ii:InfoItem =>
        ii.values.collectFirst {
          case value: StringValue if value.value.toLowerCase == "true" => true
          case value: StringValue if value.value.toLowerCase == "false" => false
          case value: StringPresentedValue if value.value.toLowerCase == "true" => true
          case value: StringPresentedValue if value.value.toLowerCase == "false" => false
          case value: BooleanValue =>
            value.value
        }
      case ii:Node =>
        throw MVError( s"$name should be an InfoItem.")
    }
  }
}
