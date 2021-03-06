// Generated by CoffeeScript 2.3.2
(function() {
  "use strict";
  var formLogicExt,
    hasProp = {}.hasOwnProperty,
    splice = [].splice;

  //##########################################################################
  //  Copyright (c) 2015 Aalto University.

  //  Licensed under the 4-clause BSD (the "License");
  //  you may not use this file except in compliance with the License.
  //  You may obtain a copy of the License at top most directory of project.

  //  Unless required by applicable law or agreed to in writing, software
  //  distributed under the License is distributed on an "AS IS" BASIS,
  //  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
  //  See the License for the specific language governing permissions and
  //  limitations under the License.
  //#########################################################################

  //#####################
  // formLogic sub module
  formLogicExt = function($, WebOmi) {
    var consts, genData, my, objChildren;
    my = WebOmi.formLogic = {};
    // Sets xml or string to request field
    my.setRequest = function(xml) {
      var mirror;
      mirror = WebOmi.consts.requestCodeMirror;
      if (xml == null) {
        mirror.setValue("");
      } else if (typeof xml === "string") {
        mirror.setValue(xml);
      } else {
        mirror.setValue(new XMLSerializer().serializeToString(xml));
      }
      return mirror.autoFormatAll();
    };
    // Gets the current request (possibly having users manual edits) as XMLDocument
    my.getRequest = function() {
      var str;
      str = WebOmi.consts.requestCodeMirror.getValue();
      return WebOmi.omi.parseXml(str);
    };
    // Do stuff with RequestDocument and automatically write it back
    // callback: Function () -> ()
    my.modifyRequest = function(callback) {
      var req;
      req = my.getRequest(); // RemoveMe
      callback();
      //my.setRequest _
      return WebOmi.requests.generate();
    };
    my.getRequestOdf = function() {
      var str;
      WebOmi.error("getRequestOdf is deprecated");
      str = WebOmi.consts.requestCodeMirror.getValue();
      return o.evaluateXPath(str, '//odf:Objects')[0];
    };
    // Remove current response from its CodeMirror and hide it with animation
    my.clearResponse = function(doneCallback) {
      var mirror;
      mirror = WebOmi.consts.responseCodeMirror;
      mirror.setValue("");
      return WebOmi.consts.responseDiv.slideUp({
        complete: function() {
          if (doneCallback != null) {
            return doneCallback();
          }
        }
      });
    };
    // Sets response (as a string or xml) and handles slide animation
    my.setResponse = function(xml, doneCallback) {
      var mirror;
      mirror = WebOmi.consts.responseCodeMirror;
      if (typeof xml === "string") {
        mirror.setValue(xml);
      } else {
        mirror.setValue(new XMLSerializer().serializeToString(xml));
      }
      mirror.autoFormatAll();
      // refresh as we "resize" so more text will become visible
      WebOmi.consts.responseDiv.slideDown({
        complete: function() {
          mirror.refresh();
          if (doneCallback != null) {
            return doneCallback();
          }
        }
      });
      return mirror.refresh();
    };
    
    //#######################################################
    // SUBSCRIPTION HISTORY CODE, TODO: move to another file?
    //#######################################################
    // Subscription history of WebSocket and callback=0 Features

    // List of subscriptions that uses websocket and should be watched
    // Type: {String_RequestID : {
    //   receivedCount : Number,
    //   userSeenCount : Number,
    //   selector : Jquery,   # selector for sub history list
    //   responses : [String]
    //   }}
    my.callbackSubscriptions = {};
    
    // Set true when the next response should be rendered to main response area
    my.waitingForResponse = false;
    // Set true when next response with requestID should be saved to my.callbackSubscriptions
    my.waitingForRequestID = false;
    // whether callbackResponseHistoryModal is opened and the user can see the new results
    my.historyOpen = false;
    consts = WebOmi.consts;
    consts.afterJquery(function() {
      consts.callbackResponseHistoryModal = $('.callbackResponseHistory');
      consts.callbackResponseHistoryModal.on('shown.bs.modal', function() {
        my.historyOpen = true;
        return my.updateHistoryCounter(true);
      }).on('hide.bs.modal', function() {
        my.historyOpen = false;
        my.updateHistoryCounter(true);
        return $('.tooltip').tooltip('hide'); // hotfix: tooltip hiding was broken
      });
      consts.responseListCollection = $('.responseListCollection');
      consts.responseListCloneTarget = $('.responseList.cloneTarget');
      return consts.historyCounter = $('.label.historyCounter');
    });
    // end afterjquery

    // toZero: should counter be reset to 0
    my.updateHistoryCounter = function(toZero = false) {
      var orginal, ref, requestID, sub, sum, update;
      update = function(sub) {
        if (toZero) {
          return sub.userSeenCount = sub.receivedCount;
        }
      };
      //###################################
      // TODO: historyCounter
      //if my.historyOpen
      orginal = parseInt(consts.historyCounter.text());
      sum = 0;
      ref = my.callbackSubscriptions;
      for (requestID in ref) {
        if (!hasProp.call(ref, requestID)) continue;
        sub = ref[requestID];
        update(sub);
        sum += sub.receivedCount - sub.userSeenCount;
      }
      if (sum === 0) {
        consts.historyCounter.text(sum).removeClass("label-warning").addClass("label-default");
      } else {
        consts.historyCounter.text(sum).removeClass("label-default").addClass("label-warning");
      }
      if (sum > orginal) {
        return WebOmi.util.flash(consts.historyCounter.parent());
      }
    };
    
    // Called when we receive relevant websocket response
    // response: String
    // returns: true if the response was consumed, false otherwise
    my.handleSubscriptionHistory = function(responseString) {
      var addHistory, cbSub, cloneElem, codeNode, createHistory, createShortenedPath, getPath, getPathValues, getShortenedPath, htmlformat, info, infoItemPathValues, infoitems, insertToTrie, maybeRequestID, maybeReturnCodes, moveHistoryHeaders, omi, pathPrefixTrie, pathValues, requestID, response, returnCodes, returnStatus, textCode, trimmedCodes, util;
      // imports
      omi = WebOmi.omi;
      util = WebOmi.util;
      response = omi.parseXml(responseString);
      // get requestID
      maybeRequestID = Maybe(omi.evaluateXPath(response, "//omi:requestID/text()")[0]);
      requestID = (maybeRequestID.bind(function(idNode) {
        var textId;
        textId = idNode.textContent.trim();
        if (textId.length > 0) {
          return Maybe(parseInt(textId));
        } else {
          return None;
        }
      })).__v;
      if ((requestID != null)) {
        cbSub = my.callbackSubscriptions[requestID];
        if (cbSub != null) {
          cbSub.receivedCount += 1;
        } else {
          // enable listing of forgotten callback requests
          if (my.waitingForRequestID || !my.waitingForResponse) {
            my.waitingForRequestID = false;
            my.callbackSubscriptions[requestID] = {
              receivedCount: 1,
              userSeenCount: 0,
              responses: [responseString]
            };
          } else {
            return false;
          }
        }
      } else if (!my.waitingForResponse) {
        requestID = "not given";
        my.callbackSubscriptions[requestID] = {
          receivedCount: 1,
          userSeenCount: 0,
          responses: [responseString]
        };
      } else {
        return false;
      }
      getPath = function(xmlNode) {
        var id, init;
        id = omi.getOdfId(xmlNode);
        if ((id != null) && id !== "Objects") {
          init = getPath(xmlNode.parentNode);
          return init + "/" + id;
        } else {
          return id;
        }
      };
      //createShortenedPath = (path) ->
      //  pathParts = path.split "/"
      //  shortenedParts = (part[0] + "…" for part in pathParts)
      //  lastI = pathParts.length - 1
      //  shortenedParts[lastI] = pathParts[lastI]
      //  shortenedParts.join "/"
      pathPrefixTrie = {};
      insertToTrie = function(root, string) {
        var head, tail;
        if (string.length === 0) {
          return root;
        } else {
          [head, ...tail] = string;
          if (root[head] == null) {
            root[head] = {};
          }
          return insertToTrie(root[head], tail);
        }
      };
      createShortenedPath = function(path) {
        var _, originalLast, prefixShorted, ref, ref1, shortedInit;
        prefixShorted = getShortenedPath(pathPrefixTrie, path);
        ref = prefixShorted.split("/"), [...shortedInit] = ref, [_] = splice.call(shortedInit, -1);
        ref1 = path.split("/"), [..._] = ref1, [originalLast] = splice.call(_, -1);
        shortedInit.push(originalLast);
        return shortedInit.join("/");
      };
      // return longest common prefix path
      getShortenedPath = function(tree, path, shortening = false) {
        var child, key, keys, tail;
        if (path.length === 0) {
          return "";
        }
        keys = Object.keys(tree);
        [key, ...tail] = path;
        child = tree[key];
        if (child == null) {
          WebOmi.debug("Error: prefix tree failure: does not exist");
          return;
        }
        if (key === "/") {
          return "/" + getShortenedPath(child, tail);
        }
        if (keys.length === 1) {
          if (shortening) {
            return getShortenedPath(child, tail, true);
          } else {
            return "..." + getShortenedPath(child, tail, true);
          }
        } else {
          return key + getShortenedPath(child, tail);
        }
      };
      getPathValues = function(infoitemXmlNode) {
        var i, infoItemName, len, path, pathObject, ref, results, value, valuesXml;
        valuesXml = omi.evaluateXPath(infoitemXmlNode, "./odf:value");
        path = getPath(infoitemXmlNode);
        insertToTrie(pathPrefixTrie, path);
        ref = path.split("/"), [...pathObject] = ref, [infoItemName] = splice.call(pathObject, -1);
        results = [];
        for (i = 0, len = valuesXml.length; i < len; i++) {
          value = valuesXml[i];
          results.push({
            path: path,
            pathObject: pathObject.join('/'),
            infoItemName: infoItemName,
            shortPath: function() {
              return createShortenedPath(path);
            },
            value: value,
            stringValue: value.textContent.trim()
          });
        }
        return results;
      };
      // Utility function; Clone the element above and empty its input fields 
      // callback type: (clonedDom) -> void
      cloneElem = function(target, callback) {
        return util.cloneElem(target, function(cloned) {
          return cloned.slideDown(null, function() { // animation, default duration
            // readjusts the position because of size change (see modal docs)
            return consts.callbackResponseHistoryModal.modal('handleUpdate');
          });
        });
      };
      // Move "Latest subscription" and "Older subscriptions"
      moveHistoryHeaders = function(latestDom) {
        var olderH;
        olderH = consts.callbackResponseHistoryModal.find('.olderSubsHeader');
        return latestDom.after(olderH);
      };
      createHistory = function(requestID) {
        var newList;
        newList = cloneElem(consts.responseListCloneTarget);
        moveHistoryHeaders(newList);
        newList.removeClass("cloneTarget");
        newList.find('.requestID').text(requestID);
        return newList;
      };
      // return: jquery elem
      returnStatus = function(count, returnCodes) {
        var row;
        if (returnCodes[0] == null) {
          returnCodes = [200];
        }
        //count = $ "<th/>" .text count
        row = $("<tr/>").addClass((function() {
          switch (Math.floor(Math.max.apply(null, returnCodes) / 100)) {
            case 2:
              return "success"; // 2xx
            case 3:
              return "warning"; // 3xx
            case 4:
              return "danger"; // 4xx
            default:
              return "warning";
          }
        })()).addClass("respRet").append($("<th/>").text(count)).append($("<th>Received callback</th>")).append($("<th/>").text(returnCodes.join(',')));
        row.tooltip({
          //container: consts.callbackResponseHistoryModal
          title: "click to show the XML"
        }).on('click', (function(row) {
          return function() { // wrap closure; Show the response xml instead of list
            var codeMirrorContainer, dataRows, responseCodeMirror, tmpRow, tmpTr;
            if ((row.data('dataRows')) != null) {
              tmpRow = row.nextUntil('.respRet');
              tmpRow.remove();
              row.after(row.data('dataRows'));
              row.removeData('mirror');
              row.removeData('dataRows');
              $('.tooltip').remove(); // hotfix: tooltip hiding was broken
            } else {
              dataRows = row.nextUntil('.respRet');
              row.data('dataRows', dataRows.clone());
              dataRows.remove();
              tmpTr = $('<tr/>');
              codeMirrorContainer = $('<td colspan=3/>');
              tmpTr.append(codeMirrorContainer);
              row.after(tmpTr);
              responseCodeMirror = CodeMirror(codeMirrorContainer[0], WebOmi.consts.responseCMSettings);
              responseCodeMirror.setValue(responseString);
              responseCodeMirror.autoFormatAll();
              row.data('mirror', responseCodeMirror);
            }
            return null;
          };
        })(row));
        
        //# Old function was to close the history and show response in the main area and flash it

        //WebOmi.formLogic.setResponse responseString, ->
        //  url = window.location.href                   #Save down the URL without hash.
        //  window.location.href = "#response"           #Go to the target element.
        //  window.history.replaceState(null,null,url)   #Don't like hashes. Changing it back.
        //  WebOmi.util.flash WebOmi.consts.responseDiv
        //WebOmi.consts.callbackResponseHistoryModal.modal 'hide'
        return row;
      };
      htmlformat = function(pathValues) {
        var i, len, pathValue, results, row;
        results = [];
        for (i = 0, len = pathValues.length; i < len; i++) {
          pathValue = pathValues[i];
          row = $("<tr/>").append($("<td/>")).append($("<td/>").append($('<span class="hidden-lg hidden-md" />').text(pathValue.shortPath)).append($('<span class="hidden-xs hidden-sm" />').text(pathValue.pathObject + '/').append($('<b/>').text(pathValue.infoItemName))).tooltip({
            //container: "body"
            container: consts.callbackResponseHistoryModal,
            title: pathValue.path
          })).append($("<td/>").tooltip({
            //container: "body"
            title: pathValue.value.attributes.dateTime.value
          }).append($("<code/>").text(pathValue.stringValue)));
          results.push(row);
        }
        return results;
      };
      addHistory = function(requestID, pathValues, returnCodes) {
        var callbackRecord, dataTable, newHistory, pathVals, responseList, returnS;
        // Note: existence of this is handled somewhere above
        callbackRecord = my.callbackSubscriptions[requestID];
        responseList = (callbackRecord.selector != null) && callbackRecord.selector.length > 0 ? callbackRecord.selector : (newHistory = createHistory(requestID), newHistory.slideDown(), my.callbackSubscriptions[requestID].selector = newHistory, newHistory);
        dataTable = responseList.find(".dataTable");
        returnS = returnStatus(callbackRecord.receivedCount, returnCodes);
        pathVals = [].concat(returnS, htmlformat(pathValues));
        pathVals = $($(pathVals).map(function() {
          return this.toArray();
        }));
        if (my.historyOpen) {
          return util.animatedShowRow(pathVals, (function() {
            return dataTable.prepend(pathVals);
          }));
        } else {
          //pathVals.last().nextAll 'tr'
          //  .each ->
          //    if $(this).data('mirror')?.refresh?
          return dataTable.prepend(pathVals);
        }
      };
      infoitems = omi.evaluateXPath(response, "//odf:InfoItem");
      infoItemPathValues = (function() {
        var i, len, results;
        results = [];
        for (i = 0, len = infoitems.length; i < len; i++) {
          info = infoitems[i];
          results.push(getPathValues(info));
        }
        return results;
      })();
      pathValues = [].concat(...infoItemPathValues);
      maybeReturnCodes = omi.evaluateXPath(response, "//omi:return/@returnCode");
      trimmedCodes = (function() {
        var i, len, results;
        results = [];
        for (i = 0, len = maybeReturnCodes.length; i < len; i++) {
          codeNode = maybeReturnCodes[i];
          results.push(codeNode.textContent.trim());
        }
        return results;
      })();
      returnCodes = (function() {
        var i, len, results;
        results = [];
        for (i = 0, len = trimmedCodes.length; i < len; i++) {
          textCode = trimmedCodes[i];
          if (textCode.length > 0) {
            results.push(parseInt(textCode));
          }
        }
        return results;
      })();
      addHistory(requestID, pathValues, returnCodes);
      // return true if request is not needed for the main area or was found on existing
      return !my.waitingForResponse || (my.callbackSubscriptions[requestID] != null);
    };
    my.createWebSocket = function(onopen, onclose, onmessage, onerror) { // Should socket be created automaticly for my or 
      var server, socket;
      WebOmi.debug("Creating WebSocket.");
      consts = WebOmi.consts;
      server = consts.serverUrl.val();
      socket = new WebSocket(server);
      socket.onopen = onopen;
      socket.onclose = function() {
        return onclose;
      };
      socket.onmessage = onmessage;
      socket.onerror = onerror;
      return my.socket = socket;
    };
    
    // send, callback is called with response text if successful
    my.send = function(callback) {
      var request, server;
      consts = WebOmi.consts;
      my.clearResponse();
      server = consts.serverUrl.val();
      request = consts.requestCodeMirror.getValue();
      if (server.startsWith("ws://") || server.startsWith("wss://")) {
        return my.wsSend(request, callback);
      } else {
        return my.httpSend(callback);
      }
    };
    // String -> void
    my.wsCallbacks = [];
    // id for canceling the keepalive scheduler
    my.keepAliveScheduler = null;
    my.startKeepAlive = function() {
      if (my.keepAliveScheduler == null) {
        return my.keepAliveScheduler = window.setInterval((function() {
          return my.wsSend("");
        }), 30000);
      }
    };
    my.stopKeepAlive = function() {
      if (my.keepAliveScheduler != null) {
        window.clearInterval(my.keepAliveScheduler);
        return my.keepAliveScheduler = null;
      }
    };
    my.wsSend = function(request, callback) {
      var maybeParsedXml, maybeVerbXml, omi, onclose, onerror, onmessage, onopen;
      if (!my.socket || my.socket.readyState !== WebSocket.OPEN) {
        onopen = function() {
          WebOmi.debug("WebSocket connected.");
          my.startKeepAlive();
          return my.wsSend(request, callback);
        };
        onclose = function() {
          WebOmi.debug("WebSocket disconnected.");
          return my.stopKeepAlive();
        };
        onerror = function(error) {
          WebOmi.debug("WebSocket error: ", error);
          return my.stopKeepAlive();
        };
        onmessage = my.handleWSMessage;
        return my.createWebSocket(onopen, onclose, onmessage, onerror);
      } else {
        if (request === "") {
          WebOmi.debug("Sending keepalive via WebSocket.");
        } else {
          WebOmi.debug("Sending request via WebSocket.");
          // Next message should be rendered to main response area
          my.waitingForResponse = true;
        }
        // Note: assume that the next response is for this request
        if (callback != null) {
          my.wsCallbacks.push(callback);
        }
        // Check if request is zero callback request
        omi = WebOmi.omi;
        maybeParsedXml = Maybe(omi.parseXml(request));
        maybeVerbXml = maybeParsedXml.bind(function(parsedXml) {
          var verbResult;
          verbResult = omi.evaluateXPath(parsedXml, "//omi:omiEnvelope/*")[0];
          return Maybe(verbResult);
        });
        maybeVerbXml.fmap(function(verbXml) {
          var isSubscriptionReq, maybeCallback, maybeInterval, verb;
          verb = verbXml.tagName;
          maybeCallback = Maybe(verbXml.attributes.callback);
          maybeInterval = Maybe(verbXml.attributes.interval);
          isSubscriptionReq = maybeCallback.exists(function(c) {
            return c.value === "0";
          }) && (verb === "omi:read" || verb === "read") && maybeInterval.isDefined;
          // done by the callback parameter
          //isReadAll = verbXml.children[0].children[0].children.length == 0
          if (isSubscriptionReq) {
            // commented because user might be waiting for some earlier response
            //y.waitingForResponse = false
            return my.waitingForRequestID = true;
          }
        });
        return my.socket.send(request);
      }
    };
    my.httpSend = function(callback) {
      var request, server;
      WebOmi.debug("Sending request with HTTP POST.");
      consts = WebOmi.consts;
      server = consts.serverUrl.val();
      request = consts.requestCodeMirror.getValue();
      consts.progressBar.css("width", "50%");
      return $.ajax({
        type: "POST",
        url: server,
        data: request,
        contentType: "text/xml",
        processData: false,
        dataType: "text",
        //complete: -> true
        error: function(response) {
          consts.progressBar.css("width", "100%");
          my.setResponse(response.responseText);
          consts.progressBar.css("width", "0%");
          consts.progressBar.hide();
          return window.setTimeout((function() {
            return consts.progressBar.show();
          }), 2000);
        },
        // TODO: Tell somewhere the "Bad Request" etc
        // response.statusText
        success: function(response) {
          consts.progressBar.css("width", "100%");
          my.setResponse(response);
          consts.progressBar.css("width", "0%");
          consts.progressBar.hide();
          window.setTimeout((function() {
            return consts.progressBar.show();
          }), 2000);
          if (callback != null) {
            return callback(response);
          }
        }
      });
    };
    my.handleWSMessage = function(message) {
      var cb, i, len, ref, response;
      consts = WebOmi.consts;
      //Check if response to subscription and put into subscription response view
      response = message.data;
      if (response.length === 0) {
        return;
      } else if (!my.handleSubscriptionHistory(response)) {
        consts.progressBar.css("width", "100%");
        my.setResponse(response);
        consts.progressBar.css("width", "0%");
        consts.progressBar.hide();
        window.setTimeout((function() {
          return consts.progressBar.show();
        }), 2000);
        my.waitingForResponse = false;
      } else {
        my.updateHistoryCounter();
      }
      ref = my.wsCallbacks;
      for (i = 0, len = ref.length; i < len; i++) {
        cb = ref[i];
        cb(response);
      }
      return my.wsCallbacks = [];
    };
    objChildren = WebOmi.omi.getObjectChildren;
    // generate jstree data
    my.OdfToJstree = genData = function(xmlNode, parentPath) {
      var child, name, path;
      switch (xmlNode.nodeName) {
        case "Objects":
          name = xmlNode.nodeName;
          return {
            id: idesc(name),
            text: name,
            state: {
              opened: true
            },
            type: "objects",
            children: (function() {
              var i, len, ref, results;
              ref = objChildren(xmlNode);
              results = [];
              for (i = 0, len = ref.length; i < len; i++) {
                child = ref[i];
                results.push(genData(child, name));
              }
              return results;
            })()
          };
        case "Object":
          name = WebOmi.omi.getOdfId(xmlNode); // FIXME: get
          path = `${parentPath}/${name}`;
          return {
            id: idesc(path),
            text: name,
            type: "object",
            children: [
              genData({
                nodeName: "description"
              },
              path)
            ].concat((function() {
              var i, len, ref, results;
              ref = objChildren(xmlNode);
              results = [];
              for (i = 0, len = ref.length; i < len; i++) {
                child = ref[i];
                results.push(genData(child, path));
              }
              return results;
            })())
          };
        case "InfoItem":
          name = WebOmi.omi.getOdfId(xmlNode); // FIXME: get
          path = `${parentPath}/${name}`;
          return {
            id: idesc(path),
            text: name,
            type: xmlNode.attributes.method != null ? "method" : "infoitem",
            children: [
              genData({
                nodeName: "description"
              },
              path),
              genData({
                nodeName: "MetaData"
              },
              path)
            ]
          };
        case "MetaData":
          path = `${parentPath}/MetaData`;
          return {
            id: idesc(path),
            text: "MetaData",
            type: "metadata",
            children: []
          };
        case "description":
          path = `${parentPath}/description`;
          return {
            id: idesc(path),
            text: "description",
            type: "description",
            children: []
          };
      }
    };
    // recursively build odf jstree from the Objects xml node
    my.buildOdfTree = function(objectsNode) {
      var tree, treeData;
      // imports
      tree = WebOmi.consts.odfTree;
      treeData = genData(objectsNode);
      tree.settings.core.data = [treeData];
      return tree.refresh();
    };
    // parse xml string and build odf jstree
    my.buildOdfTreeStr = function(responseString) {
      var objectsArr, omi, parsed;
      omi = WebOmi.omi;
      parsed = omi.parseXml(responseString); // FIXME: get
      objectsArr = omi.evaluateXPath(parsed, "//odf:Objects");
      if (objectsArr.length !== 1) {
        return WebOmi.error("failed to get single Objects odf root");
      } else {
        return my.buildOdfTree(objectsArr[0]);
      }
    };
    return WebOmi; // export
  };

  
  // extend WebOmi
  window.WebOmi = formLogicExt($, window.WebOmi || {});

  //#########################
  // Intialize widgets: connect events, import
  (function(consts, requests, formLogic) {
    return consts.afterJquery(function() {
      var controls, inputVar, makeRequestUpdater, ref;
      // Buttons
      consts.readAllBtn.on('click', function() {
        return requests.readAll(true);
      });
      consts.sendBtn.on('click', function() {
        return formLogic.send();
      });
      consts.resetAllBtn.on('click', function() {
        var child, closetime, i, len, ref;
        requests.forceLoadParams(requests.defaults.empty());
        closetime = 1500; // ms to close Objects jstree
        ref = consts.odfTree.get_children_dom('Objects');
        for (i = 0, len = ref.length; i < len; i++) {
          child = ref[i];
          consts.odfTree.close_all(child, closetime);
        }
        formLogic.clearResponse();
        return $('.clearHistory').trigger('click');
      });
      consts.sortOdfTreeCheckbox.on('change', function() {
        var root, tree;
        tree = consts.odfTreeDom.jstree();
        if (this.checked) {
          tree.settings.sort = function(a, b) {
            if (this.get_text(a) > this.get_text(b)) {
              return 1;
            } else {
              return -1;
            }
          };
          root = tree.get_node($("#Objects"));
          tree.sort(root, true);
          return tree.redraw_node(root, true);
        } else {
          return tmpTree.settings.sort = function(a, b) {
            return -1;
          };
        }
      });
      consts.convertXmlCheckbox.on('change', function() {
        var jsonRequest;
        if (this.checked) {
          window.requestXml = WebOmi.consts.requestCodeMirror.getValue();
          jsonRequest = WebOmi.jsonConverter.parseOmiEnvelope(WebOmi.omi.parseXml(window.requestXml));
          if (jsonRequest == null) {
            return alert("Invalid O-MI/O-DF");
          } else {
            WebOmi.consts.requestCodeMirror.setOption("mode", "application/json");
            WebOmi.consts.requestCodeMirror.setOption("readOnly", true);
            formLogic.setRequest = function(json) {
              var mirror;
              mirror = WebOmi.consts.requestCodeMirror;
              if (json == null) {
                return mirror.setValue("");
              } else if (typeof json === "string") {
                return mirror.setValue(json);
              } else {
                window.requestXml = new XMLSerializer().serializeToString(json);
                return mirror.setValue(JSON.stringify(WebOmi.jsonConverter.parseOmiEnvelope(json), null, 2));
              }
            };
            return formLogic.setRequest(JSON.stringify(jsonRequest, null, 2));
          }
        } else {
          WebOmi.consts.requestCodeMirror.setOption("mode", "xml");
          WebOmi.consts.requestCodeMirror.setOption("readOnly", false);
          formLogic.setRequest = function(xml) {
            var mirror;
            mirror = WebOmi.consts.requestCodeMirror;
            if (xml == null) {
              mirror.setValue("");
            } else if (typeof xml === "string") {
              mirror.setValue(xml);
            } else {
              mirror.setValue(new XMLSerializer().serializeToString(xml));
            }
            return mirror.autoFormatAll();
          };
          return formLogic.setRequest(window.requestXml);
        }
      });
      // TODO: maybe move these to centralized place consts.ui._.something
      // These widgets have a special functionality, others are in consts.ui._

      // Odf tree
      consts.ui.odf.ref.on("changed.jstree", function(_, data) {
        var odfTreePath;
        switch (data.action) {
          case "select_node":
            odfTreePath = data.node.id;
            formLogic.modifyRequest(function() {
              return requests.params.odf.add(odfTreePath);
            });
            return true;
          case "deselect_node":
            odfTreePath = data.node.id;
            formLogic.modifyRequest(function() {
              return requests.params.odf.remove(odfTreePath);
            });
            return $(jqesc(odfTreePath)).children(".jstree-children").find(".jstree-node").each(function(_, node) {
              return consts.odfTree.deselect_node(node, true);
            });
          default:
            return true;
        }
      });
      // Request select tree
      consts.ui.request.ref.on("select_node.jstree", function(_, data) {
        var i, input, isCallbackReq, isReadReq, isRequestIdReq, len, readReqWidgets, reqName, ui;
        // TODO: should ^ this ^ be changed "changed.jstree" event because it can be prevented easily
        // if data.action != "select_node" then return
        reqName = data.node.id;
        WebOmi.debug(reqName);
        // force selection to readOnce
        if (reqName === "readReq") {
          return consts.ui.request.set("read"); // should trigger a new event
        } else {
          // update ui enabled/disabled settings (can have <msg>, interval, newest, oldest, timeframe?)
          ui = WebOmi.consts.ui;
          readReqWidgets = [ui.newest, ui.oldest, ui.begin, ui.end];
          isReadReq = (function() {
            switch (reqName) {
              case "readAll":
              case "read":
              case "readReq":
                return true;
              default:
                return false;
            }
          })();
          isRequestIdReq = (function() {
            switch (reqName) {
              case "cancel":
              case "poll":
                return true;
              default:
                return false;
            }
          })();
          for (i = 0, len = readReqWidgets.length; i < len; i++) {
            input = readReqWidgets[i];
            input.ref.prop('disabled', !isReadReq);
            input.set(null);
            input.ref.trigger("input");
          }
          // TODO: better way of removing the disabled settings from the request xml
          ui.requestID.ref.prop('disabled', !isRequestIdReq);
          if (!isRequestIdReq) {
            ui.requestID.set(null);
            ui.requestID.ref.trigger("input");
          }
          isCallbackReq = reqName !== "cancel";
          ui.callback.ref.prop('disabled', !isCallbackReq);
          if (!isCallbackReq) {
            ui.callback.set(null);
            ui.callback.ref.trigger("input");
          }
          if (reqName === "subscription") {
            if (consts.serverUrl.val().startsWith("ws")) {
              ui.callback.set("0");
            }
            ui.callback.ref.trigger("input");
          } else {
            ui.callback.set(null);
            ui.callback.ref.trigger("input");
          }
          ui.requestID.ref.prop('disabled', !isRequestIdReq);
          ui.interval.ref.prop('disabled', reqName !== 'subscription');
          ui.interval.set(null);
          if (reqName === "subscription") {
            ui.interval.set(-1);
          }
          ui.interval.ref.trigger("input");
          return formLogic.modifyRequest(function() {
            var newHasMsg;
            requests.params.name.update(reqName);
            // update msg status
            newHasMsg = requests.defaults[reqName]().msg;
            return requests.params.msg.update(newHasMsg);
          });
        }
      });
      // for basic input fields
      makeRequestUpdater = function(input) {
        return function(val) {
          return formLogic.modifyRequest(function() {
            return requests.params[input].update(val);
          });
        };
      };
      ref = consts.ui;
      for (inputVar in ref) {
        if (!hasProp.call(ref, inputVar)) continue;
        controls = ref[inputVar];
        if (controls.bindTo != null) {
          controls.bindTo(makeRequestUpdater(inputVar));
        }
      }
      return null; // no return
    });
  })(window.WebOmi.consts, window.WebOmi.requests, window.WebOmi.formLogic);

  $(function() {
    return $('.optional-parameters > a').on('click', function() {
      var glyph;
      glyph = $(this).find('span.glyphicon');
      if (glyph.hasClass('glyphicon-menu-right')) {
        glyph.removeClass('glyphicon-menu-right');
        return glyph.addClass('glyphicon-menu-down');
      } else {
        glyph.removeClass('glyphicon-menu-down');
        return glyph.addClass('glyphicon-menu-right');
      }
    });
  });

  window.FormLogic = "ready";

}).call(this);
