
######################
# formLogic sub module
formLogicExt = ($, WebOmi) ->
  my = WebOmi.formLogic = {}

  my.setRequest = (xml) ->
    mirror = WebOmi.consts.requestCodeMirror
    if not xml?
      mirror.setValue ""
    else if typeof xml == "string"
      mirror.setValue xml
    else
      mirror.setValue new XMLSerializer().serializeToString xml

    mirror.autoFormatAll()

  my.getRequest = () ->
    str = WebOmi.consts.requestCodeMirror.getValue()
    WebOmi.omi.parseXml str

  # Do stuff with RequestDocument and automatically write it back
  # callback: Function
  my.modifyRequest = (callback) ->
    req = my.getRequest()
    callback()
    #my.setRequest _
    WebOmi.requests.generate()

  my.getRequestOdf = () ->
    str = WebOmi.consts.requestCodeMirror.getValue()
    o.evaluateXPath(str, '//odf:Objects')[0]


  my.setResponse = (xml) ->
    mirror = WebOmi.consts.responseCodeMirror
    if typeof xml == "string"
      mirror.setValue xml
    else
      mirror.setValue new XMLSerializer().serializeToString xml
    mirror.autoFormatAll()


  # send, callback is called with response text if successful
  my.send = (callback) ->
    server  = WebOmi.consts.serverUrl.val()
    request = WebOmi.consts.requestCodeMirror.getValue()
    $.ajax
      type: "POST"
      url: server
      data: request
      contentType: "text/xml"
      processData: false
      dataType: "text"
      #complete: -> true
      error: (response) ->
        my.setResponse response.responseText
        # TODO: Tell somewhere the "Bad Request" etc
        # response.statusText
      success: (response) ->
        my.setResponse response
        callback(response) if (callback?)

  # recursively build odf jstree from the Objects xml node
  my.buildOdfTree = (objectsNode) ->
    # imports
    tree = WebOmi.consts.odfTree
    evaluateXPath = WebOmi.omi.evaluateXPath

    objChildren = (xmlNode) ->
      evaluateXPath xmlNode, './odf:InfoItem | ./odf:Object'

    # generate jstree data
    genData = (xmlNode, parentPath) ->
      switch xmlNode.nodeName
        when "Objects"
          name = xmlNode.nodeName
          id   : name
          text : name
          state : {opened : true}
          type : "objects"
          children :
            genData(child, name) for child in objChildren(xmlNode)
        when "Object"
          name = WebOmi.omi.getOdfId(xmlNode) # FIXME: get
          path = "#{parentPath}/#{name}"
          id   : path
          text : name
          type : "object"
          children :
            genData(child, path) for child in objChildren(xmlNode)
        when "InfoItem"
          name = WebOmi.omi.getOdfId(xmlNode) # FIXME: get
          path = "#{parentPath}/#{name}"
          id   : path
          text : name
          type : "infoitem"
          children : []

    treeData = genData objectsNode
    tree.settings.core.data = [treeData]
    tree.refresh()


  # parse xml string and build odf jstree
  my.buildOdfTreeStr = (responseString) ->
    omi = WebOmi.omi

    parsed = omi.parseXml responseString # FIXME: get

    objectsArr = omi.evaluateXPath parsed, "//odf:Objects"

    if objectsArr.length != 1
      alert "failed to get single Objects odf root"
    else
      my.buildOdfTree objectsArr[0] # head, checked above


  WebOmi # export

# extend WebOmi
window.WebOmi = formLogicExt($, window.WebOmi || {})




##########################
# Intialize, connect events, import
((consts, requests, formLogic) ->
  consts.afterJquery ->
    consts.readAllBtn
      .on 'click', -> requests.readAll(true)
    consts.sendBtn
      .on 'click', -> formLogic.send()

    consts.resetAllBtn
      .on 'click', -> requests.forceLoadParams requests.defaults.empty()

    consts.ui.odf.ref
      .on "changed.jstree", (_, data) ->
        switch data.action
          when "select_node"
            formLogic.modifyRequest -> requests.params.odf.add data.node.id
          when "deselect_node"
            formLogic.modifyRequest -> requests.params.odf.remove data.node.id

    consts.ui.request.ref
      .on "select_node.jstree", (_, data) ->
        reqName = data.node.id
        console.log reqName

        # force selection to readOnce
        if reqName == "readReq"
          consts.ui.request.set "read" # should trigger a new event
        else
          # update ui enabled/disabled settings (can have <msg>, interval, newest, oldest, timeframe?)
          ui = WebOmi.consts.ui
          readReqWidgets = [ui.interval, ui.newest, ui.oldest, ui.begin, ui.end]
          isReadReq = (
            reqName == "readAll" or reqName == "read" or reqName == "readReq"
          )
          isRequestIdReq = reqName == "cancel" or reqName == "poll"

          input.ref.attr('disabled', not isReadReq) for input in readReqWidgets
          ui.requestID.ref.attr('disabled', not isRequestIdReq)

          formLogic.modifyRequest ->
            requests.params.request.update reqName
            # update msg status
            newHasMsg = requests.defaults[reqName]().msg
            requests.params.msg.update newHasMsg



)(window.WebOmi.consts, window.WebOmi.requests, window.WebOmi.formLogic)

$ ->
  $('.optional-parameters > a')
    .on 'click', () ->
      glyph = $(this).find('span.glyphicon')
      if glyph.hasClass('glyphicon-menu-right')
        glyph.removeClass('glyphicon-menu-right')
        glyph.addClass('glyphicon-menu-down')
      else
        glyph.removeClass('glyphicon-menu-down')
        glyph.addClass('glyphicon-menu-right')

