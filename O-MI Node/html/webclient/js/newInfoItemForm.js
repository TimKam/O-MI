// Generated by CoffeeScript 1.11.0
(function() {
  (function(consts, requests, omi, util) {
    var cloneAbove, createTimestampPicker, findDuplicate, getGroups, notifyErrorOn, readValues, resetInfoItemForm, updateOdf;
    cloneAbove = function(target, callback) {
      return util.cloneAbove(target, function(cloned) {
        if (callback != null) {
          callback(cloned);
        }
        return cloned.slideDown(null, function() {
          return consts.infoItemDialog.modal('handleUpdate');
        });
      });
    };
    createTimestampPicker = function(dom) {
      return dom.find('.timestamp').datetimepicker({
        format: 'X',
        sideBySide: true
      });
    };
    notifyErrorOn = function(jqElement, errorMsg) {
      return jqElement.tooltip({
        placement: "top",
        title: errorMsg
      }).focus().on('input', function() {
        return $(this).tooltip('destroy').closest('.form-group').removeClass('has-error');
      }).closest('.form-group').addClass('has-error');
    };
    consts.afterJquery(function() {
      consts.infoItemDialog = $('#newInfoItem');
      consts.infoItemForm = consts.infoItemDialog.find('form');
      consts.originalInfoItemForm = consts.infoItemForm.clone();
      consts.infoItemDialog.on('hide.bs.modal', function() {
        return resetInfoItemForm();
      });
      resetInfoItemForm();
      consts.infoItemDialog.find('.newInfoSubmit').on('click', function() {
        var infoitemData;
        infoitemData = readValues();
        return updateOdf(infoitemData);
      });
    });
    getGroups = function(ofWhat, requiredField) {
      var arr;
      arr = [];
      consts.infoItemForm.find(ofWhat).each(function() {
        var value;
        value = {};
        $(this).find(":input").each(function() {
          return value[this.name] = $(this).val();
        });
        if ((value[requiredField] != null) && value[requiredField].length > 0) {
          arr.push(value);
        }
      });
      return arr;
    };
    readValues = function() {
      var results;
      results = {};
      consts.infoItemForm.find("#infoItemName, #infoItemDescription, #infoItemParent").each(function() {
        return results[this.name] = $(this).val();
      });
      results.values = getGroups(".value-group", "value");
      results.metadatas = getGroups(".metadata-group", "metadataname");
      return results;
    };
    findDuplicate = function(arr) {
      var i, item, len, set;
      set = {};
      for (i = 0, len = arr.length; i < len; i++) {
        item = arr[i];
        if (set[item] != null) {
          return item;
        } else {
          set[item] = true;
        }
      }
      return null;
    };
    updateOdf = function(newInfoItem) {
      var duplicateInputs, duplicateTime, idName, metaObj, metas, name, parent, path, tree, v, valueObj, values;
      tree = WebOmi.consts.odfTree;
      parent = newInfoItem.parent;
      name = newInfoItem.name;
      idName = idesc(name);
      path = parent + "/" + idName;
      if ($(jqesc(path)).length > 0) {
        tree.select_node(path);
        notifyErrorOn($('#infoItemName')("InfoItem with this name already exists"));
      } else {
        v = WebOmi.util.validators;
        values = (function() {
          var i, len, ref, results1;
          ref = newInfoItem.values;
          results1 = [];
          for (i = 0, len = ref.length; i < len; i++) {
            valueObj = ref[i];
            results1.push({
              value: valueObj.value,
              type: valueObj.valuetype,
              time: v.nonEmpty(valueObj.valuetime)
            });
          }
          return results1;
        })();
        duplicateTime = findDuplicate(values.map(function(val) {
          return val.time;
        }));
        if (duplicateTime != null) {
          duplicateInputs = $("input[name='valuetime']").filter(function(_, e) {
            return $(e).val() === duplicateTime;
          });
          notifyErrorOn(duplicateInputs, "Server probably doesn't accept multiple values with the same timestamp.");
          return;
        }
        metas = (function() {
          var i, len, ref, results1;
          ref = newInfoItem.metadatas;
          results1 = [];
          for (i = 0, len = ref.length; i < len; i++) {
            metaObj = ref[i];
            results1.push({
              name: metaObj.metadataname,
              value: metaObj.metadatavalue,
              type: v.nonEmpty(metaObj.metadatatype),
              description: v.nonEmpty(metaObj.metadatadescription)
            });
          }
          return results1;
        })();
        consts.addOdfTreeNode(parent, path, name, "infoitem");
        consts.addOdfTreeNode(path, path + "/MetaData", "MetaData", "metadata");
        consts.addOdfTreeNode(path, path + "/description", "description", "description");
        $(jqesc(path)).data("values", values);
        $(jqesc(path + "/description")).data("description", v.nonEmpty(newInfoItem.description));
        $(jqesc(path + "/MetaData")).data("metadatas", metas);
        tree = WebOmi.consts.odfTree;
        tree.select_node(path);
        if ((v.nonEmpty(newInfoItem.description)) != null) {
          tree.select_node(path + "/description");
        }
        if (metas.length > 0) {
          tree.select_node(path(+"/MetaData"));
        }
        consts.infoItemDialog.modal('hide');
        resetInfoItemForm();
      }
    };
    return resetInfoItemForm = function() {
      consts.infoItemForm.replaceWith(consts.originalInfoItemForm.clone());
      consts.infoItemForm = $(consts.infoItemDialog.find('form'));
      consts.infoItemForm.submit(function(event) {
        return event.preventDefault();
      });
      consts.infoItemForm.find('.btn-clone-above').on('click', function() {
        return cloneAbove($(this), createTimestampPicker);
      });
      consts.infoItemForm.find('[data-toggle="tooltip"]').tooltip({
        container: 'body'
      });
      createTimestampPicker(consts.infoItemForm);
    };
  })(WebOmi.consts, WebOmi.requests, WebOmi.omi, WebOmi.util);

}).call(this);
