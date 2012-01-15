Ext.ns('ExtPiston');

function fkrenderer(value, metaData, record, rowIndex, colIndex, store) {
	/*
	// tego bedziemy mogli uzyc kiedy indziej
	var parts = this.dataIndex.split('__');
	parts.pop();
	var fk_name = parts.join('__');
	*/
	try {
		var ed = this.editor;
		if (ed.store.totalLength===undefined) ed.store.load();	//TODO wrzucic reszte w funkcje i jako callback
		var valueField = ed.initialConfig.valueField || ed.store.fields.keys[0];
		var index = ed.store.findExact(valueField,value);	//has to be findExact - otherwise it does a string match!! and first, that starts with a searched value matches!! eg. find('id',1) will match 10!!
		var rec = ed.store.getAt(index);
		if (!rec) return '';
		var displayField = ed.initialConfig.displayField || ed.store.fields.keys[1];
		var val = rec.data[displayField];
		return val;
	} catch (e) { return value; }
};

String.prototype.startsWith = function(str)
{return (this.match("^"+str)==str)}

String.prototype.endsWith = function(str)
{return (this.match(str+"$")==str)};

function processActions(acts, _actions, scope) {
	/*
	 * params:
	 * 	acts - actions given in initialConfig.actions,
	 * 	_actions - list of predefined actions
	 */
	var actions = new Ext.util.MixedCollection();

	if (!acts) return actions;

	_actions = _actions || {};

	var key,act;
	for(var i = 0;i < acts.length; i++) {
		//TODO jesli this.iC.actions jest obiektem (czyli key będzie stringiem i będzie nazwą predefiniowanej akcji), to robić apply/applyIf z predefiniowanymi akcjami jakoś (nadpisując lub nie) - do ustalenia, w którą stronę
		act = acts[i];
		key = i.toString();
		if (typeof(act) == "string") {		//predefined action
			if (['-','->'].indexOf(act) >= 0) {
				actions.add(act, act);
				continue;
			}
			key = act;
			if (act in _actions) act = _actions[act]		//use predefined action with that name
			else  {
				actions.add(act, act);
				console.log('invalid action name: ' + key);
				continue;
			}
		} else {
			act = Ext.apply({}, act)
			if (act.name) {
				key = act.name;	//we can define new action and give it a name
				if (key in _actions && !(act instanceof Ext.Action)) {		//we are subclassing an existing action
					act = Ext.applyIf(act, _actions[key]);
				}
			}
		}

		if (!(act instanceof Ext.Action)) {
			//if it's an object, create Ext.Action (assume it's a config object), else do nothing
			act.scope = act.scope || scope || this;
			act.width = act.width || 90;
			act = new Ext.Action(act);
		}
		actions.add(key, act);
		if (act.initialConfig.listeners) {
			var ll = act.initialConfig.listeners;
			var obj = act.initialConfig.scope;
			for (var event in ll) {
				obj.on(event, ll[event], act)
			}
		}
	}

	actions.disable = function disable() {
		this.each(function(action,index,length) {
			if (action.disable) action.disable();
		});
	}

	actions.enable = function enable() {
		this.each(function(action,index,length) {
			if (action.enable) action.enable();
		});
	}

	return actions;
};

ExtPiston.processActions = processActions;

Ext.onReady(function() {
	Ext.create = Ext.ComponentMgr.create.createInterceptor(function(config, defaultType) {
		var t = config.xtype || defaultType;
		if (!(t in this.types))
			console.log("Type " + t + " not found");
	}, Ext.ComponentMgr);
})

//fix showing and hiding of toolbars within a panel
/*
//leave this code only as an example

Ext.override(Ext.Toolbar, {
	hide: function hide() {
		this.el.setVisibilityMode(Ext.Element.DISPLAY);
		Ext.Toolbar.superclass.hide.apply(this, arguments);
		this.el.hide();
		this.syncSize();
		if (this.ownerCt) this.ownerCt.doLayout();
	},
	show: function hide() {
		this.el.show();
		this.syncSize();
		if (this.ownerCt) this.ownerCt.doLayout();
		Ext.Toolbar.superclass.show.apply(this, arguments);
	}
});
*/

//a better way to do it
Ext.override(Ext.Panel, {
	initComponent: Ext.Panel.prototype.initComponent.createSequence(function catchToolbarHide() {
		for (var i = 0; i < this.toolbars.length; i++)
			this.toolbars[i].on('hide', this.doLayout.createDelegate(this));
	})
});

function urljoin(url1, url2) {
	//TODO recognize GET params in the url
	if (url1.charAt(url1.length-1)!='/')
		return url1+'/'+url2;
	else
		return url1+url2;
}

//placeholder for translation function
if (!_)
	function _(text) {
		return text;
	}

function fixDjangoTranslation() {
	//remove django utf-8 encoding
	//unescape strings
	if (catalog != undefined) {
		var k, k2;
		for(k in catalog) {
			if (typeof(catalog[k]) != 'string') continue;
			k2 = unescape(decodeURIComponent(k)).replace("\\n","\n");		//django.view.i18n.javascript_catalog -> django.utils.text.javascript_quote
			if (k != k2)
				catalog[k2]=catalog[k];
		}
	}
}

fixDjangoTranslation();

//a shortcut to String.format, so that we can write "some {0} string {1}".format(a,b)
String.prototype.format = function() {
	return String.format.apply(this, [this].concat(Ext.toArray(arguments)));
	//old
	var b = Ext.toArray(arguments);
	var a = [this].concat(b);
	var res = String.format.apply(this, a);
	return res;
}

//add map(function) to array - iterate over the array calling given function with each element as parameter
if (!Array.prototype.map) {
	Array.prototype.map = function(fun /*, thisp*/) {
		var len = this.length;
		if (typeof fun != "function")
			throw new TypeError();

		var res = new Array(len);
		var thisp = arguments[1];
		for (var i = 0; i < len; i++) {
			if (i in this)
				res[i] = fun.call(thisp, this[i], i, this);
		}
		return res;
	};
}

//TODO add comment
Ext.override(Ext.Component, {
	getXTypes: function getXTypes() {
		var tc = this.constructor;
		if(!tc.xtypes){
			var c = [], sc = this;
			while(sc && sc.constructor){
				if (sc.constructor.xtype) c.unshift(sc.constructor.xtype);
				sc = sc.constructor.superclass;
			}
			tc.xtypeChain = c;
			tc.xtypes = c.join('/');
		}
		return tc.xtypes;
	}
});

/*
 * add '*' to required form fields
 * from http://blog.edseek.com/archives/2009/04/19/illuminate-required-fields-via-extjs/
 * see also
 * http://www.marcusschiesser.de/?p=259
 */

/*
Ext.apply(Ext.layout.FormLayout.prototype, {
	originalRenderItem:Ext.layout.FormLayout.prototype.renderItem,
	renderItem:function(c, position, target){
		/*
		if(c && !c.rendered && c.isFormField && c.fieldLabel && c.allowBlank === false) {
			c.fieldLabel = c.fieldLabel + " <span class=\"req\">*</span>";
		}
		* /
		this.originalRenderItem.apply(this, arguments);

		if(c && c.isFormField && c.fieldLabel && c.allowBlank === false) {
			c.label.addClass('x-form-item-label-required');
		}
	}
});
*/
Ext.ns('Extensive.components');

Ext.apply(Ext.layout.FormLayout.prototype, {
	originalRenderItem: Ext.layout.FormLayout.prototype.renderItem,
	renderItem: function(c, position, target){
		if (c && !c.rendered && c.isFormField && c.fieldLabel && !c.allowBlank) {
			c.fieldLabel = c.fieldLabel + " <span " + ((c.requiredFieldCls !== undefined) ? 'class="' + c.requiredFieldCls + '"' : 'style="color:red;"') + " ext:qtip=\"" + ((c.blankText !== undefined) ? c.blankText : "This field is required") + "\">*</span>";
		}
		this.originalRenderItem.apply(this, arguments);
	}
});

Extensive.components.RequiredFieldInfo = Ext.extend(Ext.form.Label, {
	constructor: function(config){
		Extensive.components.RequiredFieldInfo.superclass.constructor.call(this, Ext.apply({
			html: "<span " + ((this.requiredFieldCls !== undefined) ? 'class="' + this.requiredFieldCls + '"' : 'style="color:red;"') + '>*</span> ' + ((this.requiredFieldText !== undefined) ? this.requiredFieldText : 'Required field')
		}, config));
	}
});
Ext.reg('reqFieldInfo', Extensive.components.RequiredFieldInfo);

Extensive.components.RequiredFieldInfo.prototype.requiredFieldText = 'Pole wymagane';

Ext.reg('floatfield', Ext.form.NumberField);

Ext.Ajax.on('beforerequest', function(conn, options) {
	if (options.mask) options.mask.show();
});
Ext.Ajax.on('requestcomplete', function(conn, response, options) {
	if (options.mask) options.mask.hide();
});
Ext.Ajax.on('requestexception', function(conn, response, options) {
	if (options.mask) options.mask.hide();
});
/*
Ext.apply(Ext.data.HttpProxy.prototype, {
	originalDoRequest:Ext.data.HttpProxy.prototype.doRequest,
	doRequest:function(action, rs, params, reader, cb, scope, arg){
		if (params) {
			params = {data: Ext.encode(params)}
		}
		this.originalDoRequest.apply(this, arguments);
	}
});
*/

Ext.util.JSON.encodeDate = function encodeDate(o) {
	var fmt = 'Y-m-d';
	var fmt2 = 'Y-m-d H:i:s.u';
	if (o.format(fmt2) != o.clone().clearTime().format(fmt2)) fmt = fmt2;
	return '"'+o.format(fmt)+'"';
}

/*
* Portions of this file are based on pieces of Yahoo User Interface Library
* Copyright (c) 2007, Yahoo! Inc. All rights reserved.
* YUI licensed under the BSD License:
* http://developer.yahoo.net/yui/license.txt
*/
Ext.lib.Ajax = function() {
    var activeX = ['Msxml2.XMLHTTP.6.0',
                   'Msxml2.XMLHTTP.3.0',
                   'Msxml2.XMLHTTP'],
        CONTENTTYPE = 'Content-Type';

    // private
    function setHeader(o) {
        var conn = o.conn,
            prop,
            headers = {};

        function setTheHeaders(conn, headers){
            for (prop in headers) {
                if (headers.hasOwnProperty(prop)) {
                    conn.setRequestHeader(prop, headers[prop]);
                }
            }
        }

        Ext.apply(headers, pub.headers, pub.defaultHeaders);
        setTheHeaders(conn, headers);
        delete pub.headers;
    }

    // private
    function createExceptionObject(tId, callbackArg, isAbort, isTimeout) {
        return {
            tId : tId,
            status : isAbort ? -1 : 0,
            statusText : isAbort ? 'transaction aborted' : 'communication failure',
            isAbort: isAbort,
            isTimeout: isTimeout,
            argument : callbackArg
        };
    }

    // private
    function initHeader(label, value) {
        (pub.headers = pub.headers || {})[label] = value;
    }

    // private
    function createResponseObject(o, callbackArg) {
        var headerObj = {},
            headerStr,
            conn = o.conn,
            t,
            s,
            // see: https://prototype.lighthouseapp.com/projects/8886/tickets/129-ie-mangles-http-response-status-code-204-to-1223
            isBrokenStatus = conn.status == 1223;

        try {
            headerStr = o.conn.getAllResponseHeaders();
            Ext.each(headerStr.replace(/\r\n/g, '\n').split('\n'), function(v){
                t = v.indexOf(':');
                if(t >= 0){
                    s = v.substr(0, t).toLowerCase();
                    if(v.charAt(t + 1) == ' '){
                        ++t;
                    }
                    headerObj[s] = v.substr(t + 1);
                }
            });
        } catch(e) {}

        return {
            tId : o.tId,
            // Normalize the status and statusText when IE returns 1223, see the above link.
            status : isBrokenStatus ? 204 : conn.status,
            statusText : isBrokenStatus ? 'No Content' : conn.statusText,
            getResponseHeader : function(header){return headerObj[header.toLowerCase()];},
            getAllResponseHeaders : function(){return headerStr;},
            responseText : conn.responseText,
            responseXML : conn.responseXML,
            argument : callbackArg
        };
    }

    // private
    function releaseObject(o) {
        if (o.tId) {
            pub.conn[o.tId] = null;
        }
        o.conn = null;
        o = null;
    }

    // private
    function handleTransactionResponse(o, callback, isAbort, isTimeout) {
        if (!callback) {
            releaseObject(o);
            return;
        }

        var httpStatus, responseObject;

        try {
            if (o.conn.status !== undefined && o.conn.status != 0) {
                httpStatus = o.conn.status;
            }
            else {
                httpStatus = 13030;
            }
        }
        catch(e) {
            httpStatus = 13030;
        }

        if ((httpStatus >= 200 && httpStatus < 300) || (Ext.isIE && httpStatus == 1223)) {
            responseObject = createResponseObject(o, callback.argument);
            if (callback.success) {
                if (!callback.scope) {
                    callback.success(responseObject);
                }
                else {
                    callback.success.apply(callback.scope, [responseObject]);
                }
            }
        }
        else {
            switch (httpStatus) {
                case 12002:
                case 12029:
                case 12030:
                case 12031:
                case 12152:
                case 13030:
                    responseObject = createExceptionObject(o.tId, callback.argument, (isAbort ? isAbort : false), isTimeout);
                    if (callback.failure) {
                        if (!callback.scope) {
                            callback.failure(responseObject);
                        }
                        else {
                            callback.failure.apply(callback.scope, [responseObject]);
                        }
                    }
                    break;
                default:
                    responseObject = createResponseObject(o, callback.argument);
                    if (callback.failure) {
                        if (!callback.scope) {
                            callback.failure(responseObject);
                        }
                        else {
                            callback.failure.apply(callback.scope, [responseObject]);
                        }
                    }
            }
        }

        releaseObject(o);
        responseObject = null;
    }

    function checkResponse(o, callback, conn, tId, poll, cbTimeout){
        if (conn && conn.readyState == 4) {
            clearInterval(poll[tId]);
            poll[tId] = null;

            if (cbTimeout) {
                clearTimeout(pub.timeout[tId]);
                pub.timeout[tId] = null;
            }
            handleTransactionResponse(o, callback);
        }
    }

    function checkTimeout(o, callback){
        pub.abort(o, callback, true);
    }


    // private
    function handleReadyState(o, callback){
        callback = callback || {};
        var conn = o.conn,
            tId = o.tId,
            poll = pub.poll,
            cbTimeout = callback.timeout || null;

        if (cbTimeout) {
            pub.conn[tId] = conn;
            pub.timeout[tId] = setTimeout(checkTimeout.createCallback(o, callback), cbTimeout);
        }
        poll[tId] = setInterval(checkResponse.createCallback(o, callback, conn, tId, poll, cbTimeout), pub.pollInterval);
    }

    // private
    function asyncRequest(method, uri, callback, postData) {
        var o = getConnectionObject() || null;

        if (o) {
            o.conn.open(method, uri, true);

            if (pub.useDefaultXhrHeader) {
                initHeader('X-Requested-With', pub.defaultXhrHeader);
            }

            if(postData && pub.useDefaultHeader && (!pub.headers || !pub.headers[CONTENTTYPE])){
                initHeader(CONTENTTYPE, pub.defaultPostHeader);
            }

            if (pub.defaultHeaders || pub.headers) {
                setHeader(o);
            }

            handleReadyState(o, callback);
            o.conn.send(postData || null);
        }
        return o;
    }

    // private
    function getConnectionObject() {
        var o;

        try {
            if (o = createXhrObject(pub.transactionId)) {
                pub.transactionId++;
            }
        } catch(e) {
        } finally {
            return o;
        }
    }

    // private
    function createXhrObject(transactionId) {
        var http;

        try {
            http = new XMLHttpRequest();
        } catch(e) {
            for (var i = Ext.isIE6 ? 1 : 0; i < activeX.length; ++i) {
                try {
                    http = new ActiveXObject(activeX[i]);
                    break;
                } catch(e) {}
            }
        } finally {
            return {conn : http, tId : transactionId};
        }
    }

    var pub = {
        request : function(method, uri, cb, data, options) {
            if(options){
                var me = this,
                    xmlData = options.xmlData,
                    jsonData = options.jsonData,
                    hs;

                Ext.applyIf(me, options);

                if(xmlData || jsonData){
                    hs = me.headers;
                    if(!hs || !hs[CONTENTTYPE]){
                        initHeader(CONTENTTYPE, xmlData ? 'text/xml' : 'application/json');
                    }
                    data = xmlData || (!Ext.isPrimitive(jsonData) ? Ext.encode(jsonData) : jsonData);
                }
            }
            return asyncRequest(method || options.method || "POST", uri, cb, data);
        },

        serializeForm : function(form) {
            var fElements = form.elements || (document.forms[form] || Ext.getDom(form)).elements,
                hasSubmit = false,
                encoder = encodeURIComponent,
                name,
                data = '',
                type,
                hasValue;

            Ext.each(fElements, function(element){
                name = element.name;
                type = element.type;

                if (!element.disabled && name) {
                    if (/select-(one|multiple)/i.test(type)) {
                        Ext.each(element.options, function(opt){
                            if (opt.selected) {
                                hasValue = opt.hasAttribute ? opt.hasAttribute('value') : opt.getAttributeNode('value').specified;
                                data += String.format("{0}={1}&", encoder(name), encoder(hasValue ? opt.value : opt.text));
                            }
                        });
                    } else if (!(/file|undefined|reset|button/i.test(type))) {
                        //if (!(/radio|checkbox/i.test(type) && !element.checked) && !(type == 'submit' && hasSubmit)) {
                        //    data += encoder(name) + '=' + encoder(element.value) + '&';
                        if (/radio|checkbox/i.test(type) && !(type == 'submit' && hasSubmit)) {
                            data += encoder(name) + '=' + encoder(element.checked) + '&';
                            hasSubmit = /submit/i.test(type);
                        }
                    }
                }
            });
            return data.substr(0, data.length - 1);
        },

        useDefaultHeader : true,
        defaultPostHeader : 'application/x-www-form-urlencoded; charset=UTF-8',
        useDefaultXhrHeader : true,
        defaultXhrHeader : 'XMLHttpRequest',
        poll : {},
        timeout : {},
        conn: {},
        pollInterval : 50,
        transactionId : 0,

//  This is never called - Is it worth exposing this?
//          setProgId : function(id) {
//              activeX.unshift(id);
//          },

//  This is never called - Is it worth exposing this?
//          setDefaultPostHeader : function(b) {
//              this.useDefaultHeader = b;
//          },

//  This is never called - Is it worth exposing this?
//          setDefaultXhrHeader : function(b) {
//              this.useDefaultXhrHeader = b;
//          },

//  This is never called - Is it worth exposing this?
//          setPollingInterval : function(i) {
//              if (typeof i == 'number' && isFinite(i)) {
//                  this.pollInterval = i;
//              }
//          },

//  This is never called - Is it worth exposing this?
//          resetDefaultHeaders : function() {
//              this.defaultHeaders = null;
//          },

        abort : function(o, callback, isTimeout) {
            var me = this,
                tId = o.tId,
                isAbort = false;

            if (me.isCallInProgress(o)) {
                o.conn.abort();
                clearInterval(me.poll[tId]);
                me.poll[tId] = null;
                clearTimeout(pub.timeout[tId]);
                me.timeout[tId] = null;

                handleTransactionResponse(o, callback, (isAbort = true), isTimeout);
            }
            return isAbort;
        },

        isCallInProgress : function(o) {
            // if there is a connection and readyState is not 0 or 4
            return o.conn && !{0:true,4:true}[o.conn.readyState];
        }
    };
    return pub;
}();
