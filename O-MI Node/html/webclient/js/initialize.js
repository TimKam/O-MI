// Generated by CoffeeScript 1.9.3
(function() {
  var constsExt;

  constsExt = function($, parent) {
    var afterWaits, my;
    my = parent.consts = {};
    my.codeMirrorSettings = {
      mode: "text/xml",
      lineNumbers: true,
      lineWrapping: true
    };
    afterWaits = [];
    my.afterJquery = function(fn) {
      return afterWaits.push(fn);
    };
    $(function() {
      var basicInput, fn, i, infoItemIcon, len, loc, objectIcon, objectsIcon, requestTip, responseCMSettings, results;
      responseCMSettings = $.extend({
        readOnly: true
      }, my.codeMirrorSettings);
      my.requestCodeMirror = CodeMirror.fromTextArea($("#requestArea")[0], my.codeMirrorSettings);
      my.responseCodeMirror = CodeMirror.fromTextArea($("#responseArea")[0], responseCMSettings);
      my.responseDiv = $('.response .CodeMirror');
      my.responseDiv.hide();
      my.serverUrl = $('#targetService');
      my.odfTreeDom = $('#nodetree');
      my.requestSelDom = $('.requesttree');
      my.readAllBtn = $('#readall');
      my.sendBtn = $('#send');
      my.resetAllBtn = $('#resetall');
      my.progressBar = $('.response .progress-bar');
      loc = window.location.href;
      my.serverUrl.val(loc.substr(0, loc.indexOf("html/")));
      objectsIcon = "glyphicon glyphicon-tree-deciduous";
      objectIcon = "glyphicon glyphicon-folder-open";
      infoItemIcon = "glyphicon glyphicon-apple";
      my.odfTreeDom.jstree({
        plugins: ["checkbox", "types", "contextmenu"],
        core: {
          error: function(msg) {
            return console.log(msg);
          },
          force_text: true,
          check_callback: true
        },
        types: {
          "default": {
            icon: "odf-objects " + objectsIcon,
            valid_children: ["object"]
          },
          object: {
            icon: "odf-object " + objectIcon,
            valid_children: ["object", "infoitem"]
          },
          objects: {
            icon: "odf-objects " + objectsIcon,
            valid_children: ["object"]
          },
          infoitem: {
            icon: "odf-infoitem " + infoItemIcon,
            valid_children: []
          }
        },
        checkbox: {
          three_state: false,
          keep_selected_style: true,
          cascade: "up+undetermined",
          tie_selection: true
        },
        contextmenu: {
          show_at_node: true,
          items: function(target) {
            return {
              helptxt: {
                label: "For write request:",
                icon: "glyphicon glyphicon-pencil",
                action: function() {
                  return my.ui.request.set("write", false);
                },
                separator_after: true
              },
              add_info: {
                label: "Add an InfoItem",
                icon: infoItemIcon,
                _disabled: my.odfTree.settings.types[target.type].valid_children.indexOf("infoitem") === -1,
                action: function(data) {
                  var idName, name, path, tree;
                  tree = WebOmi.consts.odfTree;
                  parent = tree.get_node(data.reference);
                  name = window.prompt("Enter a name for the new InfoItem:", "MyInfoItem");
                  idName = idesc(name);
                  path = parent.id + "/" + idName;
                  if ($(jqesc(path)).length > 0) {
                    return;
                  }
                  return tree.create_node(parent.id, {
                    id: path,
                    text: name,
                    type: "infoitem"
                  }, "first", function() {
                    tree.open_node(parent, null, 500);
                    return tree.select_node(path);
                  });
                }
              },
              add_obj: {
                label: "Add an Object",
                icon: objectIcon,
                _disabled: my.odfTree.settings.types[target.type].valid_children.indexOf("object") === -1,
                action: function(data) {
                  var idName, name, path, tree;
                  tree = WebOmi.consts.odfTree;
                  parent = tree.get_node(data.reference);
                  name = window.prompt("Enter an identifier for the new Object:", "MyObject");
                  idName = idesc(name);
                  path = parent.id + "/" + idName;
                  if ($(jqesc(path)).length > 0) {
                    return;
                    return;
                  }
                  return tree.create_node(parent, {
                    id: path,
                    text: name,
                    type: "object"
                  }, "first", function() {
                    tree.open_node(parent, null, 500);
                    return tree.select_node(path);
                  });
                }
              }
            };
          }
        }
      });
      my.odfTree = my.odfTreeDom.jstree();
      my.odfTree.set_type('Objects', 'objects');
      my.requestSelDom.jstree({
        core: {
          themes: {
            icons: false
          },
          multiple: false
        }
      });
      my.requestSel = my.requestSelDom.jstree();
      $('[data-toggle="tooltip"]').tooltip();
      requestTip = function(selector, text) {
        return my.requestSelDom.find(selector).children("a").tooltip({
          title: text,
          placement: "right",
          container: "body",
          trigger: "hover"
        });
      };
      requestTip("#readReq", "Requests that can be used to get data from server. Use one of the below cases.");
      requestTip("#read", "Single request for latest or old data with various parameters.");
      requestTip("#subscription", "Create a subscription for data with given interval. Returns requestID which can be used to poll or cancel");
      requestTip("#poll", "Request and empty buffered data for callbackless subscription.");
      requestTip("#cancel", "Cancel and remove an active subscription.");
      requestTip("#write", "Write new data to the server. NOTE: Right click the above odf tree to create new elements.");
      basicInput = function(selector, validator) {
        if (validator == null) {
          validator = function(a) {
            return a !== "";
          };
        }
        return {
          ref: $(selector),
          get: function() {
            return this.ref.val();
          },
          set: function(val) {
            return this.ref.val(val);
          },
          bindTo: function(callback) {
            return this.ref.on("input", (function(_this) {
              return function() {
                var val;
                val = _this.get();
                if (validator(val)) {
                  return callback(val);
                } else {
                  return callback(null);
                }
              };
            })(this));
          }
        };
      };
      my.ui = {
        request: {
          ref: my.requestSelDom,
          set: function(reqName, preventEvent) {
            var tree;
            if (preventEvent == null) {
              preventEvent = true;
            }
            tree = this.ref.jstree();
            if (!tree.is_selected(reqName)) {
              tree.deselect_all();
              return tree.select_node(reqName, preventEvent, false);
            }
          },
          get: function() {
            return this.ref.jstree().get_selected[0];
          }
        },
        ttl: basicInput('#ttl'),
        callback: basicInput('#callback'),
        requestID: basicInput('#requestID'),
        odf: {
          ref: my.odfTreeDom,
          get: function() {
            return my.odfTree.get_selected();
          },
          set: function(vals, preventEvent) {
            var i, len, node, results;
            if (preventEvent == null) {
              preventEvent = true;
            }
            my.odfTree.deselect_all(true);
            if ((vals != null) && vals.length > 0) {
              results = [];
              for (i = 0, len = vals.length; i < len; i++) {
                node = vals[i];
                results.push(my.odfTree.select_node(node, preventEvent, false));
              }
              return results;
            }
          }
        },
        interval: basicInput('#interval'),
        newest: basicInput('#newest'),
        oldest: basicInput('#oldest'),
        begin: basicInput('#begin'),
        end: basicInput('#end'),
        requestDoc: {
          ref: my.requestCodeMirror,
          get: function() {
            return WebOmi.formLogic.getRequest();
          },
          set: function(val) {
            return WebOmi.formLogic.setRequest(val);
          }
        }
      };
      my.afterJquery = function(fn) {
        return fn();
      };
      results = [];
      for (i = 0, len = afterWaits.length; i < len; i++) {
        fn = afterWaits[i];
        results.push(fn());
      }
      return results;
    });
    return parent;
  };

  window.WebOmi = constsExt($, window.WebOmi || {});

  window.jqesc = function(mySel) {
    return '#' + mySel.replace(/(:|\.|\[|\]|,|\/)/g, "\\$1").replace(/( )/g, "_");
  };

  window.idesc = function(myId) {
    return myId.replace(/( )/g, "_");
  };

  String.prototype.trim = String.prototype.trim || function() {
    return String(this).replace(/^\s+|\s+$/g, '');
  };

}).call(this);
