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
      var basicInput, fn, i, len, responseCMSettings, results;
      responseCMSettings = $.extend({
        readOnly: true
      }, my.codeMirrorSettings);
      my.requestCodeMirror = CodeMirror.fromTextArea($("#requestArea")[0], my.codeMirrorSettings);
      my.responseCodeMirror = CodeMirror.fromTextArea($("#responseArea")[0], responseCMSettings);
      my.serverUrl = $('#targetService');
      my.odfTreeDom = $('#nodetree');
      my.requestSelDom = $('.requesttree');
      my.readAllBtn = $('#readall');
      my.sendBtn = $('#send');
      my.resetAllBtn = $('#resetall');
      my.odfTreeDom.jstree({
        plugins: ["checkbox", "types"],
        types: {
          "default": {
            icon: "odf-objects glyphicon glyphicon-tree-deciduous"
          },
          object: {
            icon: "odf-object glyphicon glyphicon-folder-open"
          },
          objects: {
            icon: "odf-objects glyphicon glyphicon-tree-deciduous"
          },
          infoitem: {
            icon: "odf-infoitem glyphicon glyphicon-apple"
          }
        },
        checkbox: {
          three_state: false,
          keep_selected_style: true,
          cascade: "up+undetermined",
          tie_selection: true
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
      basicInput = function(selector) {
        return {
          ref: $(selector),
          get: function() {
            return this.ref.val();
          },
          set: function(val) {
            return this.ref.val(val);
          }
        };
      };
      my.ui = {
        request: {
          ref: my.requestSelDom,
          set: function(reqName) {
            var tree;
            tree = this.ref.jstree();
            if (!tree.is_selected(reqName)) {
              tree.deselect_all();
              return tree.select_node(reqName, true, false);
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
          set: function(vals) {
            var i, len, node, results;
            my.odfTree.deselect_all(true);
            if ((vals != null) && vals.length > 0) {
              results = [];
              for (i = 0, len = vals.length; i < len; i++) {
                node = vals[i];
                results.push(my.odfTree.select_node(node, true, false));
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
    return '#' + mySel.replace(/(:|\.|\[|\]|,|\/)/g, "\\$1");
  };

  String.prototype.trim = String.prototype.trim || function() {
    return String(this).replace(/^\s+|\s+$/g, '');
  };

}).call(this);
