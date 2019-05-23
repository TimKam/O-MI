// Generated by CoffeeScript 2.3.2
(function() {
  var xmlConverter;

  xmlConverter = function(WebOmi) {
    var my;
    // Sub module for handling omi xml
    my = WebOmi.jsonConverter = {};
    my.parseXml = function(xmlString) {
      var ex, xmlTree;
      try {
        xmlTree = new DOMParser().parseFromString(xmlString, 'application/xml');
      } catch (error) {
        ex = error;
        xmlTree = null;
        console.log("ParseError while parsing input string");
      }
      if (xmlTree.firstElementChild.nodeName === "parsererror" || (xmlTree == null)) {
        console.log("PARSE ERROR:");
        console.log("in:", responseString);
        console.log("out:", xmlTree);
        xmlTree = null;
      }
      return xmlTree;
    };
    my.ns = {
      omi: "http://www.opengroup.org/xsd/omi/1.0/",
      odf: "http://www.opengroup.org/xsd/odf/1.0/"
    };
    my.nsResolver = function(name) {
      return my.ns[name] || my.ns.odf;
    };
    my.filterNullKeys = function(obj) {
      return (Object.entries(obj).filter(function(item) {
        return item[1] != null;
      })).reduce(function(a, b) {
        return Object.assign(a, {
          [b[0]]: b[1]
        });
      }, {});
    };
    my.evaluateXPath = function(elem, xpath) {
      var iter, res, results, xpe;
      xpe = elem.ownerDocument || elem;
      iter = xpe.evaluate(xpath, elem, my.nsResolver, 0, null);
      results = [];
      while (res = iter.iterateNext()) {
        results.push(res);
      }
      return results;
    };
    
    //my.omiEnvelope = (xml) ->
    //  xml.getElementsByTagName("omiEnvelope")[0]
    my.parseOmiEnvelope = function(xml) {
      var calls, cancels, deletes, ex, reads, responses, result, ttl, version, writes;
      if (xml == null) {
        return null;
      }
      try {
        version = my.exSingleAtt(my.evaluateXPath(xml, "/omi:omiEnvelope/@version"));
        ttl = my.exSingleAtt(my.evaluateXPath(xml, "/omi:omiEnvelope/@ttl"));
        if (Number(ttl) !== -1 && Number(ttl) < 0 || (ttl == null)) {
          ttl = null;
          throw "Invalid Interval";
        } else {
          ttl = Number(ttl);
        }
      } catch (error) {
        ex = error;
        version = null;
        ttl = null;
      }
      if ((version == null) || (ttl == null)) {
        return null;
      }
      try {
        reads = my.evaluateXPath(xml, 'omi:omiEnvelope/omi:read');
        if (reads.length !== 1) {
          reads = null;
        } else {
          reads = my.parseRead(reads[0]);
        }
      } catch (error) {
        ex = error;
        reads = null;
      }
      try {
        writes = my.evaluateXPath(xml, 'omi:omiEnvelope/omi:write');
        if (writes.length !== 1) {
          writes = null;
        } else {
          writes = my.parseWrite(writes[0]);
        }
      } catch (error) {
        ex = error;
        writes = null;
      }
      try {
        responses = my.evaluateXPath(xml, 'omi:omiEnvelope/omi:response');
        if (responses.length !== 1) {
          responses = null;
        } else {
          responses = my.parseResponse(responses[0]);
        }
      } catch (error) {
        ex = error;
        responses = null;
      }
      try {
        cancels = my.evaluateXPath(xml, 'omi:omiEnvelope/omi:cancel');
        if (cancels.length !== 1) {
          cancels = null;
        } else {
          cancels = my.parseCancel(cancels[0]);
        }
      } catch (error) {
        ex = error;
        cancels = null;
      }
      try {
        calls = my.evaluateXPath(xml, 'omi:omiEnvelope/omi:call');
        if (calls.length !== 1) {
          calls = null;
        } else {
          calls = my.parseCall(calls[0]);
        }
      } catch (error) {
        ex = error;
        calls = null;
      }
      try {
        deletes = my.evaluateXPath(xml, 'omi:omiEnvelope/omi:delete');
        if (deletes.length !== 1) {
          deletes = null;
        } else {
          deletes = my.parseDelete(deletes[0]);
        }
      } catch (error) {
        ex = error;
        deletes = null;
      }
      result = {
        version: version,
        ttl: ttl,
        read: reads,
        write: writes,
        response: responses,
        cancel: cancels,
        call: calls,
        delete: deletes
      };
      return {
        omiEnvelope: my.filterNullKeys(result)
      };
    };
    my.exSingleAtt = function(res) {
      if (res == null) {
        return null;
      }
      if (res.length !== 1) {
        if (res.length > 1) {
          throw "invalid number of attributes";
        }
        return null;
      }
      return res[0].value;
    };
    my.exSingleNode = function(res) {
      var ex, node;
      if (res == null) {
        return null;
      }
      try {
        return node = res.textContent;
      } catch (error) {
        ex = error;
        return null;
      }
    };
    //if (res.length != 1)
    //  if (res.length > 1)
    //    throw "invalid number of Nodes"
    //  return null
    //else
    //  res.textContent
    my.parseRequestId = function(xml) {
      var ex, format, id;
      if (xml == null) {
        return null;
      }
      try {
        format = my.exSingleAtt(my.evaluateXPath(xml, "./@format"));
      } catch (error) {
        ex = error;
        format = null;
      }
      id = xml.textContent;
      if (format === null) {
        return id;
      } else {
        return {
          id: id,
          format: format
        };
      }
    };
    my.parseNodesType = function(xml) {
      var ex, node, type;
      if (xml == null) {
        return null;
      }
      try {
        type = my.exSingleAtt(my.evaluateXPath(xml, "./@type"));
      } catch (error) {
        ex = error;
        type = null;
      }
      node = my.evaluateXPath(xml, "./omi:node").map(my.exSingleNode);
      if (type == null) {
        return {
          node: node
        };
      } else {
        return {
          type: type,
          node: node
        };
      }
    };
    my.parseBaseType = function(xml) {
      var callback, ex, msg, msgformat, nodeList, requestId, result, targetType;
      if (xml == null) {
        return null;
      }
      try {
        callback = my.exSingleAtt(my.evaluateXPath(xml, "./@callback"));
      } catch (error) {
        ex = error;
        callback = null;
      }
      try {
        msgformat = my.exSingleAtt(my.evaluateXPath(xml, "./@msgformat"));
      } catch (error) {
        ex = error;
        msgformat = null;
      }
      try {
        targetType = my.exSingleAtt(my.evaluateXPath(xml, "./@targetType"));
      } catch (error) {
        ex = error;
        targetType = null;
      }
      try {
        requestId = my.evaluateXPath(xml, "./omi:requestID").map(my.parseRequestId);
        if (requestId.length === 1) {
          requestId = requestId[0];
        } else if (requestId.length === 0) {
          requestId = null;
        }
      } catch (error) {
        ex = error;
        requestId = null;
      }
      try {
        nodeList = my.evaluateXPath(xml, "./omi:nodeList").map(my.parseNodesType);
        if (nodeList.length === 1) {
          nodeList = nodeList[0];
        } else if (requestId.length === 0) {
          requestId = null;
        }
      } catch (error) {
        ex = error;
        nodeList = null;
      }
      try {
        msg = my.parseMsg(my.evaluateXPath(xml, "./omi:msg")[0]);
      } catch (error) {
        ex = error;
        msg = null;
      }
      result = {
        callback: callback,
        msgformat: msgformat,
        targetType: targetType,
        nodeList: nodeList,
        requestId: requestId,
        msg: msg
      };
      return my.filterNullKeys(result);
    };
    my.parseRead = function(xml) {
      var all, baseType, begin, end, ex, interval, maxlevels, newest, oldest, readObj, readResult, result;
      if (xml == null) {
        return null;
      }
      baseType = my.parseBaseType(xml);
      try {
        interval = my.exSingleAtt(my.evaluateXPath(xml, "./@interval"));
        if (Number(interval) !== -1 && Number(interval) !== -2 && Number(interval) < 0 || interval === null) {
          interval = null;
        } else {
          interval = Number(interval);
        }
      } catch (error) {
        ex = error;
        interval = null;
      }
      try {
        oldest = Number(my.exSingleAtt(my.evaluateXPath(xml, "./@oldest")));
        if (!Number.isInteger(oldest) || oldest < 1) {
          console.log(`invalid oldest value: ${oldest}`);
          oldest = null;
        }
      } catch (error) {
        ex = error;
        oldest = null;
      }
      try {
        begin = my.exSingleAtt(my.evaluateXPath(xml, "./@begin"));
      } catch (error) {
        ex = error;
        begin = null;
      }
      try {
        end = my.exSingleAtt(my.evaluateXPath(xml, "./@end"));
      } catch (error) {
        ex = error;
        end = null;
      }
      try {
        newest = Number(my.exSingleAtt(my.evaluateXPath(xml, "./@newest")));
        if (!Number.isInteger(newest) || newest < 1) {
          newest = null;
        }
      } catch (error) {
        ex = error;
        newest = null;
      }
      try {
        all = my.exSingleAtt(my.evaluateXPath(xml, "./@all"));
        if (all == null) {
          all = null;
        }
      } catch (error) {
        ex = error;
        all = null;
      }
      try {
        maxlevels = my.exSingleAtt(my.evaluateXPath(xml, "./@maxlevels"));
        if (!Number.isInteger(Number(maxlevels)) || maxlevels < 1) {
          maxlevels = null;
        } else {
          maxlevels = Number(maxlevels);
        }
      } catch (error) {
        ex = error;
        maxlevels = null;
      }
      readObj = {
        interval: interval,
        oldest: oldest,
        begin: begin,
        end: end,
        newest: newest,
        all: all,
        maxlevels: maxlevels
      };
      readResult = my.filterNullKeys(readObj);
      return result = {...baseType, ...readResult};
    };
    my.parseWrite = function(xml) {
      if (xml == null) {
        return null;
      }
      return my.parseBaseType(xml);
    };
    my.parseReturnType = function(xml) {
      var description, ex, returnCode;
      if (xml == null) {
        return null;
      }
      try {
        returnCode = my.exSingleAtt(my.evaluateXPath(xml, "./@returnCode"));
        if (returnCode.length < 2) {
          console.log(`invalid returnCode: ${returnCode}`);
          returnCode = null;
        }
      } catch (error) {
        ex = error;
        console.log(`invalid returnCode: ${ex}`);
        returnCode = null;
      }
      try {
        description = my.exSingleAtt(my.evaluateXPath(xml, "./@description"));
      } catch (error) {
        ex = error;
        description = null;
      }
      if (returnCode == null) {
        return null;
      } else {
        if (description == null) {
          return {
            returnCode: returnCode
          };
        } else {
          return {
            returnCode: returnCode,
            description: description
          };
        }
      }
    };
    my.parseRequestResultType = function(xml) {
      var ex, msg, msgformat, nodeList, omiEnvelope, requestId, result, returnT, targetType;
      if (xml == null) {
        return null;
      }
      try {
        msgformat = my.exSingleAtt(my.evaluateXPath(xml, "./@msgformat"));
      } catch (error) {
        ex = error;
        console.log(ex);
        msgformat = null;
      }
      try {
        targetType = my.exSingleAtt(my.evaluateXPath(xml, "./@targetType"));
      } catch (error) {
        ex = error;
        console.log(ex);
        targetType = null;
      }
      try {
        returnT = my.parseReturnType(my.evaluateXPath(xml, "./omi:return")[0]);
      } catch (error) {
        ex = error;
        console.log(ex);
        returnT = null;
      }
      try {
        requestId = my.parseRequestId(my.evaluateXPath(xml, "./omi:requestId")[0]);
        if ((returnT != null) && (requestId != null)) {
          console.log("both return and requestID found");
          requestId = null;
        }
      } catch (error) {
        ex = error;
        console.log(ex);
        requestId = null;
      }
      try {
        msg = my.parseMsg(my.evaluateXPath(xml, "./omi:msg")[0]);
      } catch (error) {
        ex = error;
        console.log(ex);
        msg = null;
      }
      try {
        nodeList = my.parseNodesType(my.evaluateXPath(xml, "./omi:nodeList")[0]);
      } catch (error) {
        ex = error;
        console.log(ex);
        nodeList = null;
      }
      try {
        omiEnvelope = my.parseOmiEnvelope(my.evaluateXPath(xml, "./omi:omiEnvelope")[0]);
      } catch (error) {
        ex = error;
        console.log(ex);
        omiEnvelope = null;
      }
      result = {
        msgformat: msgformat,
        targetType: targetType,
        return: returnT,
        requestId: requestId,
        msg: msg,
        nodeList: nodeList,
        omiEnvelope: omiEnvelope
      };
      return my.filterNullKeys(result);
    };
    my.parseResponse = function(xml) {
      var ex, result;
      if (xml == null) {
        return null;
      }
      try {
        result = my.headOrElseNull(my.evaluateXPath(xml, "./omi:result").map(my.parseRequestResultType));
      } catch (error) {
        ex = error;
        result = null;
      }
      if (result != null) {
        return {
          result: result
        };
      } else {
        return null;
      }
    };
    my.parseCancel = function(xml) {
      var ex, nodeList, requestId, result;
      if (xml == null) {
        return null;
      }
      try {
        nodeList = my.parseNodesType(my.evaluateXPath(xml, "./omi:nodeList")[0]);
      } catch (error) {
        ex = error;
        nodeList = null;
      }
      try {
        requestId = my.evaluateXPath(xml, "./omi:requestID").map(my.parseRequestId);
        if (requestId.length === 1) {
          requestId = requestId[0];
        } else if (requestId.length === 0) {
          requestId = null;
        }
      } catch (error) {
        ex = error;
        requestId = null;
      }
      result = {
        nodeList: nodeList,
        requestId: requestId
      };
      return my.filterNullKeys(result);
    };
    my.parseCall = function(xml) {
      if (xml == null) {
        return null;
      }
      return my.parseBaseType(xml);
    };
    my.parseDelete = function(xml) {
      if (xml == null) {
        return null;
      }
      return my.parseBaseType(xml);
    };
    my.parseMsg = function(xml) {
      var ex, objects;
      if (xml == null) {
        return null;
      }
      try {
        //check msgformat?
        objects = my.evaluateXPath(xml, "./odf:Objects");
        if (objects.length !== 1) {
          objects = null;
        } else {
          objects = my.parseObjects(objects[0]);
        }
      } catch (error) {
        ex = error;
        console.log(ex);
        objects = null;
      }
      if (objects == null) {
        return null;
      } else {
        return {
          Objects: objects
        };
      }
    };
    
    //--------ODF Part-------#
    my.headOrElseNull = function(res) {
      if (res.length === 1) {
        return res[0];
      } else if (res.length === 0) {
        return null;
      } else {
        return res;
      }
    };
    my.parseIoTIdType = function(xml) {
      var endDate, ex, id, idType, result, startDate, tagType;
      if (xml == null) {
        return null;
      }
      try {
        id = my.exSingleNode(xml);
      } catch (error) {
        ex = error;
        console.log("ID missing");
        id = null;
      }
      try {
        idType = my.exSingleAtt(my.evaluateXPath(xml, "./@idType"));
      } catch (error) {
        ex = error;
        idType = null;
      }
      try {
        tagType = my.exSingleAtt(my.evaluateXPath(xml, "./@tagType"));
      } catch (error) {
        ex = error;
        tagType = null;
      }
      try {
        startDate = my.exSingleAtt(my.evaluateXPath(xml, "./@startDate"));
      } catch (error) {
        ex = error;
        startDate = null;
      }
      try {
        endDate = my.exSingleAtt(my.evaluateXPath(xml, "./@endDate"));
      } catch (error) {
        ex = error;
        endDate = null;
      }
      if ((idType != null) || (tagType != null) || (startDate != null) || (endDate != null)) {
        result = {
          id: id,
          idType: idType,
          tagType: tagType,
          startDate: startDate,
          endDate: endDate
        };
        return my.filterNullKeys(result);
      } else {
        return id;
      }
    };
    my.parseObjects = function(xml) {
      var ex, objects, prefix, result, version;
      if (xml == null) {
        return null;
      }
      try {
        version = my.exSingleAtt(my.evaluateXPath(xml, "./@version"));
      } catch (error) {
        ex = error;
        console.log(ex);
        version = null;
      }
      try {
        prefix = my.exSingleAtt(my.evaluateXPath(xml, "./@prefix"));
      } catch (error) {
        ex = error;
        console.log(ex);
        prefix = null;
      }
      try {
        objects = my.headOrElseNull(my.evaluateXPath(xml, "./odf:Object").map(my.parseObject));
      } catch (error) {
        ex = error;
        console.log(ex);
        objects = null;
      }
      result = {
        version: version,
        prefix: prefix,
        Object: objects
      };
      return my.filterNullKeys(result);
    };
    my.parseObject = function(xml) {
      var descriptions, ex, ids, infoitems, objects, type;
      if (xml == null) {
        return null;
      }
      try {
        ids = my.headOrElseNull(my.evaluateXPath(xml, "./odf:id").map(my.parseIoTIdType));
      } catch (error) {
        ex = error;
        console.log(ex);
        ids = null;
        console.log("Object Id missing");
      }
      try {
        type = my.exSingleAtt(my.evaluateXPath(xml, "./@type"));
      } catch (error) {
        ex = error;
        console.log(ex);
        type = null;
      }
      try {
        objects = my.headOrElseNull(my.evaluateXPath(xml, "./odf:Object").map(my.parseObject));
      } catch (error) {
        ex = error;
        console.log(ex);
        objects = null;
      }
      try {
        infoitems = my.headOrElseNull(my.evaluateXPath(xml, "./odf:InfoItem").map(my.parseInfoItem));
      } catch (error) {
        ex = error;
        console.log(ex);
        infoitems = null;
      }
      try {
        descriptions = my.headOrElseNull(my.evaluateXPath(xml, "./odf:description").map(my.parseDescription));
      } catch (error) {
        ex = error;
        console.log(ex);
        descriptions = null;
      }
      if (ids != null) {
        return my.filterNullKeys({
          id: ids,
          type: type,
          description: descriptions,
          InfoItem: infoitems,
          Object: objects
        });
      } else {
        return null;
      }
    };
    my.parseInfoItem = function(xml) {
      var altnames, descriptions, ex, metadatas, name, type, values;
      if (xml == null) {
        return null;
      }
      try {
        name = my.exSingleAtt(my.evaluateXPath(xml, "./@name"));
      } catch (error) {
        ex = error;
        console.log("name missing for infoitem");
        name = null;
      }
      try {
        type = my.exSingleAtt(my.evaluateXPath(xml, "./@type"));
      } catch (error) {
        ex = error;
        type = null;
      }
      try {
        altnames = my.headOrElseNull(my.evaluateXPath(xml, "./odf:altname").map(my.parseIoTIdType));
      } catch (error) {
        ex = error;
        altnames = null;
      }
      try {
        values = my.headOrElseNull(my.evaluateXPath(xml, "./odf:value").map(my.parseValue));
      } catch (error) {
        ex = error;
        values = null;
      }
      try {
        metadatas = my.headOrElseNull(my.evaluateXPath(xml, "./odf:MetaData").map(my.parseMetaData));
      } catch (error) {
        ex = error;
        metadatas = null;
      }
      try {
        descriptions = my.headOrElseNull(my.evaluateXPath(xml, "./odf:description").map(my.parseDescription));
      } catch (error) {
        ex = error;
        descriptions = null;
      }
      if (name == null) {
        return null;
      } else {
        return my.filterNullKeys({
          name: name,
          type: type,
          altname: altnames,
          description: descriptions,
          MetaData: metadatas,
          value: values
        });
      }
    };
    my.parseDescription = function(xml) {
      var ex, lang, text;
      if (xml == null) {
        return null;
      }
      try {
        text = my.exSingleNode(xml);
      } catch (error) {
        ex = error;
        console.log("Empty description");
        text = null;
      }
      try {
        lang = my.exSingleAtt(my.evaluateXPath(xml, "./@lang"));
      } catch (error) {
        ex = error;
        lang = null;
      }
      if (text == null) {
        return null;
      } else {
        return my.filterNullKeys({
          lang: lang,
          text: text
        });
      }
    };
    my.parseMetaData = function(xml) {
      var ex, infoitems;
      if (xml == null) {
        return null;
      }
      try {
        infoitems = my.headOrElseNull(my.evaluateXPath(xml, "./odf:InfoItem").map(my.parseInfoItem));
      } catch (error) {
        ex = error;
        infoitems = null;
      }
      if (infoitems != null) {
        return {
          InfoItem: infoitems
        };
      } else {
        return "";
      }
    };
    my.parseValue = function(xml) {
      var content, dateTime, ex, objects, type, unixTime;
      if (xml == null) {
        return null;
      }
      try {
        type = my.exSingleAtt(my.evaluateXPath(xml, "./@type"));
      } catch (error) {
        ex = error;
        type = null;
      }
      try {
        dateTime = my.exSingleAtt(my.evaluateXPath(xml, "./@dateTime"));
      } catch (error) {
        ex = error;
        dateTime = null;
      }
      try {
        unixTime = my.exSingleAtt(my.evaluateXPath(xml, "./@unixTime"));
        if (unixTime == null) {
          unixTime = null;
        } else {
          unixTime = Number(unixTime);
        }
      } catch (error) {
        ex = error;
        unixTime = null;
      }
      try {
        content = my.exSingleNode(xml);
        content = (function() {
          switch (type.toLowerCase()) {
            case "xs:string":
              return content;
            case "xs:integer":
              return Number(content);
            case "xs:int":
              return Number(content);
            case "xs:long":
              return Number(content);
            case "xs:decimal":
              return Number(content);
            case "xs:double":
              return Number(content);
            case "xs:integer":
              return Number(content);
            case "xs:boolean":
              switch (content.toLowerCase()) {
                case "true":
                  return true;
                case "false":
                  return false;
                case "1":
                  return true;
                case "0":
                  return false;
                default:
                  return false;
              }
              break;
            default:
              return content;
          }
        })();
      } catch (error) {
        ex = error;
        content = null;
      }
      try {
        objects = my.parseObjects(my.evaluateXPath(xml, "./odf:Objects")[0]);
      } catch (error) {
        ex = error;
        objects = null;
      }
      if (objects != null) {
        return my.filterNullKeys({
          type: type,
          dateTime: dateTime,
          unixTime: unixTime,
          content: {
            Objects: objects
          }
        });
      } else {
        return my.filterNullKeys({
          type: type,
          dateTime: dateTime,
          unixTime: unixTime,
          content: content
        });
      }
    };
    return WebOmi;
  };

  window.WebOmi = xmlConverter(window.WebOmi || {});

  window.json = "ready";

}).call(this);
