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
                        if (!(type == 'submit' && hasSubmit)) {
                            if (!(/radio/i.test(type) && !element.checked))
                                data += encoder(name) + '=' + encoder(element.value) + '&';
                            else if (/checkbox/i.test(type))
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
/*
 * $ Revision: $
 *
 * definicje walidacji
 */

Ext.apply(Ext.form.VTypes,{
	SubnetSpec: function(v){
		var re_sub = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\/\d{1,2}$/;
		var re_ip = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/;
		function testIP(ip) {
			if (!re_ip.test(ip)) return false;
			var tab=ip.split('.');
			for(var i=0;i<=3;i++) 
				if (tab[i]<0 || tab[i]>255) 
					return false;
			return true;
		};
		function testSub(sub) {
			if (!re_sub.test(sub)) 
				return testIP(sub);
			var tab = sub.split('/');
			if (tab[1]<1 || tab[1]>32) return false;
			return testIP(tab[0]);
		};
		var t=v.split('-');
		if (t.length==1) return testSub(v);
		if (t.length==2) return testIP(t[0]) && testIP(t[1]);
		return false;
	},
	SubnetSpecText:'Podaj adres sieci z maską lub zakres adresów IP'
});

// vim: set fileencoding=utf-8

Ext.namespace("ExtPiston.data");
ExtPiston.data.JsonStore = Ext.extend(Ext.data.JsonStore, {
	constructor: function(config) {
		var config = config || {};
		var cfg = {
			autoSave: false,
			messageProperty: 'message',
			root: 'data',
			restful: true,
			method: 'GET',
			idProperty: 'id'
		};
		Ext.applyIf(config, cfg);

		if (config.writeable) {
			var writer = new Ext.data.JsonWriter(config);
			var writer = new Ext.data.JsonWriter(Ext.apply(config,{encode: false}));
			Ext.apply(config, {writer: writer});
		}

		var listeners = {
			write: function(store, action, result, res, rs) {
				if (res['success']) {
					App.setAlert(true, res.message || 'OK');
				} else {
					App.setAlert(false, res.message || 'PROCESSING ERROR');
				}
			},
			exception: function(DataProxy, type, action, options, response, arg) {
				if (type == 'remote') {
					App.setAlert(false, _("Wystąpił błąd:  {0} {1}").format(response.message, ''));
				} else
				App.setAlert(false, _("Wystąpił błąd:  {0} {1}").format(response.status, response.statusText));
			}
		};

		Ext.apply(config, {listeners: listeners});

		ExtPiston.data.JsonStore.superclass.constructor.call(this, config);
		if (!this.url)
			console.log('ExtPiston.data.JsonStore warning: url not set in: ' + (this.xtype || 'xtype not set'));
		this.origUrl = this.url;
	}
});

Ext.reg('extpiston.jsonstore', ExtPiston.data.JsonStore);

Ext.namespace('ExtPiston.grid');

ExtPiston.grid.Grid = {
	loadMask: true,
	preInit: function preInit() {
	},
	postInit: function postInit() {
	},
	initActionBar: function initActionBar() {
		//initiate toolbar and context menu if there are any actions defined
		if (this.actions.length>0) {
			if (!this.tbar) {
				this.tbar = [];
			}
			else this.tbar.push('-');

			//initiate context menu
			var menu = new Ext.menu.Menu();
			this.menu = menu;
			//events fired this way work, however when defined as separate methods, they don't...
			this.on('rowcontextmenu', function(grid, index, event){
				grid.getSelectionModel().selectRow(index);
			});

			this.on('contextmenu', function(event){
				event.stopEvent();
				menu.showAt(event.xy);
			});

			/*
			for each([index, action] in Iterator(this.actions)) {
				this.tbar.push(action);
				menu.add(action);
				if (index<actions.length-1) this.tbar.push('-');
			}
			*/
			//TODO actions shoud be some kind of an objects/collection (a class shoud be defined for it)
			this.actions.each(function(action,index,length) {
				this.tbar.push(action);
				if (index<length-1) this.tbar.push('-');
				if (action == '->') return;
				menu.add(action);
			}, this);
		}
	},
	setBaseUrl: function(baseUrl) {
		//TODO zrobić to lepiej... dużo lepiej...
		this.origUrl = this.origUrl || this.store.url;
		if (!(this.childUrl || this.url) ) console.log('error: childUrl not set in {0} {1}'.format(this.xtype, this.name));

		var url = baseUrl+'/' + this.childUrl || this.url;
		this.store.url = url;		//so that we don't need to get grid.store.proxy.url, but only grid.store.url
		this.store.proxy.setUrl(url,true);
	},
	getBaseUrl: function getBaseUrl(rec) {
		var rec = rec || this.getSelectionModel().getSelected();
		if (!rec) return null;
		return urljoin(this.origUrl || this.store.url, rec.id);
	},
	setDynamicBaseUrl: function(store) {
		//if it's a function, call it to get current base url
		//if (typeof(this.initialConfig.baseUrl) == "function") this.store.proxy.setUrl(this.initialConfig.baseUrl()+'/{{ name|lower }}', true);
		if (typeof(this.initialConfig.baseUrl) == "function") this.store.proxy.setUrl(this.initialConfig.baseUrl()+'/' + this.childUrl, true);
	},
	adjustHeightToFitMaxRows: false,				//CONFIG
	adjustHeight: function adjustHeight() {
		if (!this.adjustHeightToFitMaxRows) return;		//CONFIG
		if (!this.el) return;
		var scr = Ext.query('div.x-grid3-scroller', this.el.dom)[0];
		var rows = Ext.query('div.x-grid3-row', scr);
		rows = Array.prototype.slice.call(rows,0);
		//var els = Ext.query('div.x-grid3-cell-inner', scr);
		if (!rows.length) return;

		var tb;

		for(var i = 0; i < this.toolbars.length; i++) {
			tb = this.toolbars[i].pageSize;
			if (tb) break;
		}
		if (!tb) return;
		//var dh = scr.clientHeight - this.bottomToolbar.pageSize * (rows[0].clientHeight+2);
		var dh = scr.clientHeight - tb * (rows[0].clientHeight+2);
		this.setHeight(this.getHeight()-dh);
	}
}

ExtPiston.grid.GridPanel = Ext.extend(
	Ext.extend(Ext.grid.GridPanel, ExtPiston.grid.Grid),
	{
	initComponent:function() {
		this.namespace = this.namespace || '';
		var formClass = this.initialConfig.formClass || this.namespace.toLowerCase()+'.form';

		var editWindow = {
			title: "",
			xtype: 'window',
			autoHeight: true,
			width: 400,
			items: {
				xtype: formClass,		//TODO accept form definition as well, not only xtype (as with editWindow)
				header: false
			}
		};

		if (this.initialConfig.editFormConfig) Ext.apply(editWindow.items, this.initialConfig.editFormConfig);
		if (this.initialConfig.editForm) editWindow.items = this.initialConfig.editForm;

		if (this.initialConfig.windowClass) editWindow = {xtype: this.initialConfig.windowClass};
		if (this.initialConfig.editWindowConfig) Ext.apply(editWindow, this.initialConfig.editWindowConfig);
		if (this.initialConfig.editWindow) editWindow = this.initialConfig.editWindow;

		this.showWindow = function(grid, showRec, params) {
			editWindow.baseUrl = grid.store.url;
			var ew = Ext.apply({}, params, editWindow);
			var win = new Ext.create(ew,'window');
			this.win = win;
			var frmp = win.findByType('form')[0];		//TODO switch to using ref
			win.form = frmp;
			frmp.closeOnSave = this.initialConfig.closeOnSave;

			frmp.setBaseUrl(grid.store.url);
			if (showRec) {
				var rec = grid.getSelectionModel().getSelected();
				if (rec) win.findByType('form')[0].getForm().loadRecord(rec);		//TODO 'form' instead of formClass to make it more generic- a good way would be to add ref to main form...
			};
			if (frmp.initialConfig.title && !win.initialConfig.title) win.setTitle(frmp.initialConfig.title);
			win.show();
			win.on('close',grid.store.reload.createDelegate(grid.store));
			frmp.on('cancel',win.close.createDelegate(win));
			win.on('beforeclose', this.beforeClose, frmp);
		};

		var _actions = {
			add : {
				text: _("Nowy"),
				handler: function(button, event, params) {	//button and event are params passed to the action when it's clicked as a toolbar button or menu item, params is my own
					this.showWindow(this,false, params);
					this.win.form.on('actioncomplete', function setPass(form,action) {
						this.fireEvent('addItem', this, action.result.data);
					}, this);
				},
				name: 'add'
			},
			edit: {
				text: _("Edytuj"),
				handler: function(button, event, params) {
					var rec = this.getSelectionModel().getSelected();
					if (rec) {
						this.showWindow(this,true);
					} else Ext.MessageBox.alert(_('Błąd'),_('Proszę wybrać pozycję'));
				},
				name: 'edit'
			},
			remove: {
				text: _("Usuń"),
				handler: function(button, event, params) {
					var rec = this.getSelectionModel().getSelected();
					if (rec) {
						Ext.MessageBox.confirm(_("Potwierdzenie"), _("Czy jesteś pewien, że chcesz usunąć wybraną pozycję?"), function cb(btn) {
							if (btn != 'yes') return;
							this.store.remove(rec);
							if (!this.store.writer.autoSave) this.store.save();
						}, this);
					} else Ext.MessageBox.alert(_('Błąd'),_('Proszę wybrać pozycję'));
				},
				name: 'remove'
			}
		};

		//add any actions given by the user to our actions
		this.actions = processActions(this.initialConfig.actions, _actions, this);

		//if defined, bind edit action with double click event
		var editAction = this.actions.get('edit');
		if (editAction) {
			this.on('celldblclick',function(grid, rowIndex, columnIndex, event){
				grid.getSelectionModel().selectRow(rowIndex);
				if (!editAction.isDisabled()) editAction.execute();
			});
		}

		//initiate toolbar and context menu if there are any actions defined
		this.initActionBar();

		//TODO kiedy robić tą inicjalizację z akcjami? przed czy po superclass.initComponent??

		if (this.initialConfig.filterBy) {
			var tb = this.tbar = this.tbar || [];
			tb.push(new Ext.ux.form.SearchField({paramName: 'filter__'+this.initialConfig.filterBy, store: this.initialConfig.store, grid: this}));
		}

		this.on('viewready', this.adjustHeight);
		this.store.on('load', this.adjustHeight, this);
		ExtPiston.grid.GridPanel.superclass.initComponent.apply(this, arguments);

		this.relayEvents(this.getSelectionModel(),['selectionchange','rowselect']);

		if (this.initialConfig.baseUrl) {				//if a component handles a related field, baseUrl is added to url
			var baseUrl = this.initialConfig.baseUrl;
			if (typeof(baseUrl) == "string")
				this.setBaseUrl(baseUrl);
			//TODO to zrobić jako eventy, bo jak jest funkcja, to znaczy, że ma być dynamiczne
			//else if (typeof(baseUrl) == "function")
			//	config.store.url = baseUrl()+'/'+config.store.url
			//	else
			//		throw "{{app_label|title}}.{{name}}.gridInit: invalid baseUrl: "+baseUrl;
		}
		//dynamic base url setting
		this.postInit();
		this.addEvents(['addItem','removeItem']);
	}, //initComponent
	beforeClose: function(panel) {
		if (this.form.isDirty())
			return confirm(_('Formularz zawiera niezapisane dane. Czy na pewno chcesz zamknąć okno?'));
	}
});

Ext.reg('extpiston.grid',ExtPiston.grid.GridPanel);

ExtPiston.grid.EditorGridPanel = Ext.extend(
	Ext.extend(Ext.grid.EditorGridPanel, ExtPiston.grid.Grid),
	{
	initComponent:function() {
		var _actions = {
			add: {
				text: _('Dodaj'),name: 'add',
				handler: function add(btn, ev) {
					//TODO
					var rec = {};
					var store = this.getStore();

					//what was this for??
					/*
					for(var i=0; i<store.fields.keys.length; i++) {
						var f = store.fields.keys[i];
						if (f != store.reader.meta.idProperty) rec[f]='';
					}
					*/
					//initialize default values	TODO reocrdType should do it by itself?...
					store.fields.each(function(f) {
						if (f.defaultValue != "")
							rec[f.name]=f.defaultValue;
					});
					var u = new store.recordType(rec);	//nie trzeba, ale wtedy cały się podświetla i jest wyraźniej
					u.markDirty();
					this.stopEditing();
					store.insert(0, u);
					//find first editable cell
					var cm = this.colModel;
					var editableCells = cm.getColumnsBy(function checkIfEditable(c, i) {
						return c.editable;
						return this.isCellEditable(0,i);	//this would return true if column has editor property set, but editable==false and we don't want it
					});
					if (editableCells.length > 0)
						this.startEditing(0,editableCells[0].id);
					this.fireEvent('addItem', this, u);
				}
			},
			remove:  {
				text: _('Usuń'), name: 'remove',
				handler: function remove() {
					var rec = this.getSelectionModel().selection.record;
					if (rec) {
						Ext.MessageBox.confirm(_("Potwierdzenie"), _("Czy jesteś pewien, że chcesz usunąć wybraną pozycję?"), function cb(btn) {
							if (btn != 'yes') return;
							this.store.remove(rec);
							if (!this.store.writer.autoSave) this.store.save();
						}, this);
					} else Ext.MessageBox.alert(_('Błąd'),_('Proszę wybrać pozycję'));
					return;
					var sm = this.getSelectionModel();
					var rec = sm.getSelectedCell();
					var store = this.getStore();
					if (!rec) {
						return false;
					}
					store.removeAt(rec[0]);
					var cnt = store.getCount();
					if (cnt > 0) {
						if (cnt<=rec[0]) sm.select(cnt-1,1);
						else sm.select(rec[0],1);
					}
					this.fireEvent('removeItem', this, rec);
				}
			},
			save: {
				text: _('Zapisz'), name: 'save',
				handler: function save(btn, ev) {
					this.getStore().save();
				}
			}
		};

		this.actions = processActions(this.initialConfig.RESTbuttons || ['add','remove','save'], _actions, this);

		this.initActionBar();

		ExtPiston.grid.EditorGridPanel.superclass.initComponent.apply(this, arguments);

		this.relayEvents(this.getSelectionModel(),['selectionchange', 'cellselect']);
		this.addEvents(['addItem','removeItem']);
		this.postInit();
	}	//initComponent
});
Ext.reg('extpiston.editorgrid',ExtPiston.grid.EditorGridPanel);
// vim: fileencoding=utf-8
// vim: filetype=javascript

Ext.namespace('ExtPiston.form');

Ext.namespace('ExtPiston.form.Action');
ExtPiston.form.Action.Submit = Ext.extend(Ext.form.Action.Submit, {
	run: function run() {
		//disable unchanged fields before submitting
		var fields = new Array();
		this.items.each(
			function disableIfNeeded(item, index, length) {
				var a = 0;
			}, this);

		ExtPiston.form.Action.Submit.superclass.run.apply(this, arguments);
		//enable unchanged fields after submitting
	}
});

/*
Ext.override(Ext.form.BasicForm, {
    getFieldValues : function(dirtyOnly, raw){
        var o = {},
            n,
            key,
            val;
        this.items.each(function(f) {
            if (!f.disabled && (dirtyOnly !== true || f.isDirty())) {
                n = f.getName();
                key = o[n];
                if (raw) val = f.getRawValue(); else val = f.getValue();

                if(Ext.isDefined(key)){
                    if(Ext.isArray(key)){
                        o[n].push(val);
                    }else{
                        o[n] = [key, val];
                    }
                }else{
                    o[n] = val;
                }
            }
        });
        return o;
    }
});

Ext.override(Ext.form.ComboBox, {
	getRawValue : function(){
		var v = this.rendered ? this.hiddenField.value : Ext.value(this.value, '');
		if(v === this.emptyText){
			v = '';
		}
		return v;
	}
});
*/

ExtPiston.form.FormPanel = Ext.extend(Ext.form.FormPanel, {
	constructor: function constructor(cfg) {
		cfg = cfg || {};
		ExtPiston.form.FormPanel.superclass.constructor.call(this, cfg);
		if (!this.url)
			console.log('ExtPiston.form.FormPanel warning: url not set in: ' + (this.xtype || 'xtype not set'));
		this.origUrl = this.url;
	},
	initComponent: function() {
		var config = {
			bodyStyle:'padding:5px 5px 0',
			bubbleEvents: ['cancel','save'],
			defaults: {anchor: '100%'},
			frame: true,
			items: [],
			keys: [
				{
					key: [Ext.EventObject.ENTER],
					handler: function onEnterKey(key, ev) {
						//TODO preserve it if config contains keys property as well or add it based on other config param (submitOnEnter) or TODO make actions listen to keys...
						if (ev.target.type == 'textarea') return;
						this.actions.get('save').execute();
					},
				scope: this
				}
			],
			labelWidth: 100,
			closeOnCreate: true,
			trackResetOnLoad: true,
			loadMask: true
		};

		Ext.apply(this, Ext.applyIf(this.initialConfig, config));

		if (this.ns) {
			/*
			 * if our local namespace is defined, we can setup items property given field names only
			 *
			 * If names are given - add only those fields, otherwise add all available fields
			 */
			if (this.initialConfig.fields) {
				for (var i = 0; i< this.initialConfig.fields.length; i++) {
					var name = this.initialConfig.fields[i];
					if (typeof(name)=="string")
						config.items.push(Ext.apply({},this.ns.formFields[name]));
						//TODO handle field definitions
				}
			} else {
				for (var name in this.ns.formFieldNames) {
					name = this.ns.formFieldNames[name];
					var field = this.ns.formFields[name];
					if (field) config.items.push(Ext.apply({}, field));
				}
			}
		} //if (this.ns)

		Ext.apply(this, Ext.applyIf(this.initialConfig, config));
		//TODO change save to submit
		var _actions = {
			apply: {
				text: 'Zastosuj',
				handler: function() {
					var o = {saveMode: 'apply'}
					this.form.submit(o);
				},
				name: 'save'
			},
			save: {
				text: 'OK',
				handler: function() {
					var o = {saveMode: 'save'}
					this.form.submit(o);
				},
				name: 'save'
			},
			cancel: {
				text: 'Anuluj',
				handler: function() {
					this.fireEvent('cancel');
				},
				name: 'cancel'
			}
		};

		//add any actions given by the user to our actions
		this.actions = processActions(this.initialConfig.actions || ['save','cancel', 'apply'], _actions, this);

		if (this.actions.length>0) {
			if (this.initialConfig.buttons)
				this.buttons = this.initialConfig.buttons;
			else
				this.buttons = [];

			this.actions.each(function(action,index,length) {
				this.buttons.push(action);
				if (index<length-1) this.buttons.push('-');
			}, this);
		};

		ExtPiston.form.FormPanel.superclass.initComponent.apply(this, arguments);
		this.form.actions = this.actions;

		/*
		//TODO do it using create sequence
		var old_f = this.form.setValues.createDelegate(this.form);
		var setValues = function(values) {
			old_f(values);
			this.fireEvent('setvalues',this,values);
		}
		this.form.setValues = setValues.createDelegate(this.form);
		*/

		this.form.setValues = this.form.setValues.createSequence(function(values) {
				if (this.onSetValues) this.onSetValues(values);
				this.fireEvent('setvalues',this,values);
			},
			this.form			//TODO to nie jest do konca potrzebne chyba
		);

		this.form.addEvents('setvalues');
		this.form.getPk = this.getPk.createDelegate(this);

		this.on('beforeaction',this.beforeAction,this);
		this.on('actioncomplete',this.actionComplete,this);
		this.on('actionfailed',this.actionFailed,this);
		this.on('beforeclose',this.beforeClose,this);
		this.form.on('setvalues',this.setProtectedFields,this);
	}, //initComponent
	setProtectedFields: function setProtectedFields() {
		if (this.protectedFields && this.getPk() != null) {
			for(var i = 0; i < this.protectedFields.length; i++) {
				var f = this.form.findField(this.protectedFields[i]);
				if (f) f.disable();
			}
		}
	},
	setBaseUrl: function setBaseUrl(baseUrl) {
		//TODO rethink it
		var f = this.form;
		f.origUrl = f.origUrl || f.url || this.url;
		if (!f.origUrl) console.log('extpiston.form warning: origUrl still undefined');
		f.url = baseUrl;
	},
	getBaseUrl: function() {
		var pk = this.getPk();
		if (pk != null) {
			var url = this.form.origUrl || this.form.url;
			if (!url) {
				console.log('ExtPiston.form.FormPanel error: url not set in: '+(this.xtype || 'type not set'));
				return null;
			}
			return urljoin(url,pk);
		}
		else
			return null;
	},
	getPk: function() {
		var pk = this.form.findField(this.pkField);
		if (!pk) return null;
		var pkv = pk.getValue();
		if (pkv == undefined || pkv == null || pkv == "") return null;
		return pkv;
	},
	beforeAction: function(form, action) {
		var url = this.form.url;
		var pkv = this.getPk();
		var o = action.options;
		if (pkv != null) {
			url = urljoin(url,pkv);
			o.method = 'PUT';
		} else o.method = 'POST';

		o.url = url;
		if (this.mask) this.mask.show();
		var removeFields = [];
		form.items.each(
			function checkIfDirty(f, index, length) {
				if (f.name == form.pkField) return;
				if (!f.isDirty() || f.originalValue === undefined && f.getValue() == '')
					removeFields.push(f.name);
			},
			form
		);
		action.options.params = action.options.params || {};
		action.options.params._remove_fields = removeFields.join(',');
	},
	actionComplete: function(form, action) {
		if (this.mask) this.mask.hide();
		App.setAlert(true, action.result.message || 'OK');
		if (action.type == 'submit') {
			var oldpk = this.getPk();
			form.setValues(action.result.data);
			this.fireEvent('save',form,action);
			if (action.options.saveMode == 'save' && (oldpk == null && this.closeOnCreate || oldpk != null)) {
				if (this.ownerCt instanceof Ext.Window)
					this.ownerCt.close();
			}
		};
	},
	actionFailed: function(form, action) {
		if (this.mask) this.mask.hide();
		switch (action.failureType) {
			case Ext.form.Action.CLIENT_INVALID:
				App.setAlert(false, 'Błąd danych w formularzu');
				break;
			case Ext.form.Action.CONNECT_FAILURE:
				var msg = _('Błąd serwera');
				try {
					var msg2 = ':\n' + action.response.status + ': ' + (action.response.getResponseHeader('content-type')=='text/html' ? action.response.statusText : action.response.responseText);
					msg += msg2;
				} catch (e) {};

				if (action.response.status == 401) {
					msg = _('Brak uprawnień');
					if (action.response.responseText) msg += ':\n' + action.response.responseText;
				}
				App.setAlert(false, msg);
				break;
			case Ext.form.Action.SERVER_INVALID:
				App.setAlert(false, action.result.message || 'PROCESSING ERROR');
				break;
		};
	},
	beforeClose: function(panel) {
		if (panel.form.isDirty())
			return confirm('Formularz zawiera niezapisane dane. Czy na pewno chcesz zamknąć okno?');
	},
	onRender: function onRender() {
		ExtPiston.form.FormPanel.superclass.onRender.apply(this, arguments);
		if ((!this.mask && this.mask != false) || this.mask == true || !(this.mask instanceof Ext.LoadMask)) {
			//TODO szukać maski, jeśli to będzie obiekt i ewentualnie rzucać błędem
			this.mask = new Ext.LoadMask(this.getEl(), {msg: _("Please wait...")});
		}
	}
});

Ext.reg('extpiston.form',ExtPiston.form.FormPanel);
Ext.namespace('ExtPiston.m2m');

/* usage:
 * plugins: ['masterslave']
 *
 * and optionally:
 * masterComponent: 'path/to/component' //starting from parent
 * where empty path means direct parent
 *
 * or
 *
 * masterComponent: {path: 'path/to/component, event: 'eventname'}
 * where eventname is optional
 *
 * or
 *
 * masterComponent: {component: path.to.created.component [, event: 'eventname]}
 * where component is an object instance
 *
 * Paths are by itemId
 */

ExtPiston.MasterSlavePlugin = (function() {
	function _getByPath(obj,path) {
		if (!obj) return;
		if (path[0] == '..') return _getByPath(obj.ownerCt,path.slice(1));
		var newobj = obj.find('itemId',path[0])[0];	//TODO change to get (nonrecursive)
		if (!newobj) return _getByPath(obj.ownerCt, path);	//if object is not found, go up until there's nothing up there or the object is found
		//TODO fix it for better logic
		if (path.length == 1) {
			if (newobj) return newobj;
			if (!path[0]) return obj;		//path was empty which means the owner object itself
			//TODO raise an error
			return;
		}
		return _getByPath(newobj,path.slice(1));
	};

	function getByPath(obj,path) {
		return _getByPath(obj, path.split('/'));
	};

	function GridPanelHandler(sm,rowIndex,param3) {		//for gridpanel param3=record, for editorgridpanel param3=colindex
		var st = sm.grid.store;
		var rec = st.getAt(rowIndex);
		if (rec.phantom) return null;
		var url = st.origUrl || st.url;
		return url+'/'+rec.id;
	};

	function FormPanelHandler(form,values) {
		//TODO use getBaseUrl?
		if (!form.getPk) return null;
		var pk = form.getPk();
		if (pk == null || pk == undefined) return null;
		var url = form.origUrl || form.url;
		return url+'/'+pk;
	};

	return {
		init: function(o) {
			var obj;
			var m = o.initialConfig.masterComponent;		//TODO maybe we should assume, that if no master is given, it should always be our direct parent and only issue a warning
			if (typeof(m) == 'string') m = {path: m};		//allow master component to be given directly by name

			if (o.ownerCt instanceof Ext.FormPanel) {		//autodetect forms
				o.url = o.initialConfig.name;
				o.childUrl = o.url;
				if (!m) m = {path: ''}
				if (!m.path)					//if no path was given, assume we want parent form
					obj = o.ownerCt.form;			//we need the form, not panel, and form can't be found with 'find'
			};

			if (!m) return;		//neither we're part of a form nor master-slave relation has been defined	TODO see todo above :)

			obj = m.component || obj || getByPath(o.ownerCt,m.path);	//target object can either be given directly, implicitly (if we're form's child) or it will be searched by path
			if (!obj) {
				console.log("MaterSlavePlugin: cant find master component");
				return;
			}

			if (!m.event) {
				if (obj instanceof Ext.grid.EditorGridPanel) m.event = 'cellselect';
				else if (obj instanceof Ext.grid.GridPanel) m.event = 'rowselect';
				else if (obj instanceof Ext.form.BasicForm) m.event = 'setvalues';
				else throw "masterComponent.event must be defined";
			};
			//else if (obj instanceof Ext.FormPanel) m.event = 'setvalues';

			if (!m.handler) {
				if (obj instanceof Ext.grid.EditorGridPanel) m.handler = GridPanelHandler;
				else if (obj instanceof Ext.grid.GridPanel) m.handler = GridPanelHandler;
				else if (obj instanceof Ext.form.BasicForm) m.handler = FormPanelHandler;
				else throw "masterComponent.handler must be defined";
			};
			//else if (obj instanceof Ext.FormPanel) m.handler = FormPanelHandler;
			//if (obj instanceof Ext.grid.GridPanel)
				if (!o.childUrl)
					console.log("childUrl for related component not set: "+o.xtype);

			var scope = obj;
			if (m.scope == 'slave') scope = o;		//TODO what should be the default scope? slave?...
			obj.on(m.event, function() {
					var url = m.handler.apply(scope,arguments);		//TODO write generic handlers for different grids/forms and pass them only field name (or they can get it from store.idProperty and so on)
					if (!url) {
						this.disable();
						return;
					}
					this.enable();
					if (Ext.isString(url)) this.setBaseUrl(url);			//if url is not a string but evals to true it means that handler did all the stuff and now just reload
					if (this.store && !this.store.autoLoad) this.store.load();		//not everything has a store (i.e m2mpanel)
					}, o);
			o.disable();
		}
	}
})();

Ext.preg('masterslave',ExtPiston.MasterSlavePlugin);

ExtPiston.m2m.GridPanel = Ext.extend(ExtPiston.grid.GridPanel, {
	initComponent: function () {
		/*
		 * it needs valueField, displayField, url, baseUrl
		 */

		var StoreConfig = {
			url: this.initialConfig.url || 'set_me',
			//url: '/test',
//			baseParams: {
//				{% if page_size %}limit:{{ page_size }},start: 0,{% endif %}
//			},
			method: 'GET',
			root: 'data',
			fields: [ this.initialConfig.valueField || 'id', this.initialConfig.displayField || '__str__'],
			writer: new Ext.data.JsonWriter({encode:true}),
			autoSave: true,
			idProperty: this.initialConfig.valueField || 'id',
			restful: true
		};
		var store = new Ext.data.JsonStore(StoreConfig);

		this.initialConfig.columns = [
			{hidden: true, header: 'ID', hideable: false, dataIndex: this.initialConfig.valueField || 'id'},
			{header: '&#160;', dataIndex: this.initialConfig.displayField || '__str__'}
		];

		var config = {
			viewConfig: {
				forceFit: true
			},
			enableHdMenu: false,
			hideHeaders: true,
			store: store
		};

		if (this.initialConfig.baseUrl) {				//if a component handles a related field, baseUrl is added to url
			var baseUrl = this.initialConfig.baseUrl;
			if (typeof(baseUrl) == "string")
				this.setBaseUrl(baseUrl);
		}
		//dynamic base url setting
		var setDynamicBaseUrl = function(store) {
			//if it's a function, call it to get current base url
			if (typeof(this.baseUrl) == "function") this.store.proxy.setUrl(this.initialConfig.baseUrl()+'/'+this.url);
		}
		config.store.on('beforeload', setDynamicBaseUrl, this);
		config.store.on('beforesave', setDynamicBaseUrl, this);
		config.store.on('beforewrite', setDynamicBaseUrl, this); //is this necessary?

		Ext.applyIf(this.initialConfig, config);
		Ext.apply(this,this.initialConfig);

		ExtPiston.m2m.GridPanel.superclass.initComponent.apply(this, arguments);

	}, //initComponent
	setBaseUrl: function(baseUrl) {
		//TODO zrobić to lepiej... dużo lepiej...
		var url = baseUrl+this.url;
		this.baseUrl = baseUrl;
		this.store.url = url;		//optional for unified look
		this.store.proxy.setUrl(url,true);
	}
});

Ext.reg('extpiston.m2m.grid',ExtPiston.m2m.GridPanel);

//TODO many of this code is common with ExtPiston.grid... do something about it...
ExtPiston.m2m.Panel = Ext.extend(Ext.Panel, {
	initComponent: function () {
		var config = {
			valueField: 'id',
			displayField: '__str__',
			baseUrl: '',	//url part that comes from parent component like /name/pk_value/ - may be a function to set it dynamically
			url: this.initialConfig.name || '',	//url that will be added to baseUrl and set as url of the grids
			layout: 'hbox',
			layoutConfig: {
				align: 'stretch'
			},
			height: 220,
			plugins: ['masterslave'],
			tools: [{
				id: 'refresh',
				handler: function(event, toolEl, panel, tc) {
					panel.grid1.store.reload();
					panel.grid2.store.reload();
				}
			}]
		}
		Ext.applyIf(this.initialConfig, config);
		Ext.apply(this,this.initialConfig);

		var grid = {
			xtype: 'extpiston.m2m.grid',
			header: true,
			flex: 1
			//border: false
		}

		this.items = [];

		var grid1 = {itemId: 'left', title: _('Not assigned')};
		var grid2 = {itemId: 'right', title: _('Assigned')};

		function selRow(grid) {
			var sm = grid.getSelectionModel();
			var cnt = sm.grid.store.getCount() - 1;
			var last = sm.last == false ? cnt : sm.last;
			sm.selectRow(Math.min(last, cnt));
		}

		function add(grid, rowIndex, columnIndex, e) {
			var rec, s_st;
			if (grid instanceof Ext.grid.GridPanel) {
				s_st = grid.getStore();
				rec = s_st.getAt(rowIndex);
			} else {
				s_st = this.grid1.getStore();
				rec = this.grid1.getSelectionModel().getSelected();
				if (!rec) return;
			}
			var d_st = this.grid2.getStore();
			rec.phantom = true;
			s_st.remove(rec);
			d_st.add(rec);
			if (!d_st.autoSave) d_st.save();
			selRow(this.grid1);
			selRow(this.grid2);
			this.fireEvent('change');
		}

		function remove(grid, rowIndex, columnIndex, e) {
			var rec, s_st;
			if (grid instanceof Ext.grid.GridPanel) {
				s_st = grid.getStore();
				rec = s_st.getAt(rowIndex);
			} else {
				s_st = this.grid2.getStore();
				rec = this.grid2.getSelectionModel().getSelected();
				if (!rec) return;
			}
			var d_st = this.grid1.getStore();
			d_st.add(rec);
			s_st.remove(rec);
			selRow(this.grid1);
			selRow(this.grid2);
			this.fireEvent('change');
		}
		var buttonsCol = {
			width: 35,
			layout: {
				type: 'vbox',
				align: 'stretch',
				pack: 'center'
			},
			defaults: {
				xtype: 'button',
				scope: this,
				height: 26,
				margins: "3px 3px"
			},
			items: [{
				text: '>',
				handler: add
			//}, {
			//	text: '>>'
			}, {
				text: '<',
				handler: remove
			//}, {
			//	text: '<<'
			}]
		}
		var props_to_copy = [
			'childUrl',
			'displayField',
			'name',
			'url',
			'filterBy',
			'valueField'
		];
		Ext.copyTo(grid, this.initialConfig, props_to_copy);
		grid.height = (this.initialConfig.height || config.height)-37;

		Ext.apply(grid1, grid);
		Ext.apply(grid2, grid);

		this.items.push(grid1);
		this.items.push(buttonsCol);
		this.items.push(grid2);

		ExtPiston.m2m.Panel.superclass.initComponent.apply(this, arguments);

		this.grid1 = this.find('itemId','left')[0];
		this.grid2 = this.find('itemId','right')[0];

		this.grid2.on('celldblclick', remove, this);
		this.grid1.on('celldblclick', add, this);
		this.addEvents('change');
	}, //initComponent
	setBaseUrl: function(baseUrl) {
		this.baseUrl = baseUrl;
		var url = this.url;		//TODO this should be taken from this.initialConfig or this only ?

		this.grid1.store.proxy.setUrl(this.baseUrl+'/'+url, true);
		this.grid1.store.setBaseParam('all',1);
		this.grid1.store.load();
		this.grid2.store.proxy.setUrl(this.baseUrl+'/'+url, true);
		this.grid2.store.load();
		this.enable();
	    }
});

Ext.reg('extpiston.m2m',ExtPiston.m2m.Panel);
Ext.ns('Extpiston.grid');

Extpiston.grid.ToolbarCombo = Ext.extend(Ext.form.ComboBox, {
	//constructor: function MyToolBarCombo(config) {
	initComponent: function initComponent() {
		var config = {
			width: 100,
			forceSelection: true,
			triggerAction: 'all'
		}
		Ext.applyIf(this.initialConfig, config)
		Ext.apply(this, this.initialConfig)
		if (!this.value) {
			if (Ext.isArray(this.store))
				this.value = this.store[0][0];
			else if (this.store instanceof Ext.data.Store && this.store.getCount()>0) {
				r = this.store.getAt(0);
				try {
					f = r.fields.get(0).name;
					this.value = r.data[f];
				} catch (e) {};
			}
		}

		Extpiston.grid.ToolbarCombo.superclass.initComponent.apply(this, arguments);
		this.on('select', function onSelect(combo) {
			var grid = this.findParentByType('grid');
			grid.store.setBaseParam(combo.name, combo.getValue());
			grid.store.load();
		});
	}
});

Ext.reg('extpiston.grid.toolbarcombo', Extpiston.grid.ToolbarCombo);


/*
 * $ Revision: $
 * Grid współpracujący domyślnie z pistonowym webservice'em (subklasą Ext*)
 */

Ext.ns('mk');

mk.RestfulEditorGridPanel = Ext.extend(Ext.grid.EditorGridPanel, {
	initComponent: function() {
		var onSave = function onSave(btn, ev) {
			//TODO
			this.store.save();
		}

		var onAdd = function onAdd(btn, ev) {
			//TODO
			var rec = {}
			for(var i=0; i<this.store.fields.keys.length; i++) {
				var f = this.store.fields.keys[i];
				if (f != this.store.reader.meta.idProperty) rec[f]='';
			}
			var u = new this.store.recordType(rec);	//nie trzeba, ale wtedy cały się podświetla i jest wyraźniej
			u.markDirty();
			this.stopEditing();
			this.store.insert(0, u);
			this.startEditing(0,1);	//TODO - to sie musi samo wymyslac albo znajdywac
		}

		var onDelete = function onDelete() {
			var sm = this.getSelectionModel();
			var rec = sm.getSelectedCell();
			if (!rec) {
				return false;
			}
			this.store.removeAt(rec[0]);
			var cnt = this.store.getCount();
			if (cnt<=rec[0]) sm.select(cnt-1,1);
			else sm.select(rec[0],1)
		}
		
		var proxyConfig = {		
			url: this.initialConfig.url
		};
		if (this.initialConfig.proxyConfig) proxyConfig = Ext.apply(proxyConfig,this.initialConfig.proxyConfig);

		var proxy = new Ext.data.HttpProxy(proxyConfig); //proxy

		if (this.initialConfig.remoteFilter) 
			proxy.remoteFilter = this.initialConfig.remoteFilter;

		proxy.addListener('beforeload', function(proxy,params) {
			if (this.remoteFilter)
				params = Ext.apply(params,this.remoteFilter);
		});

		var writer = new Ext.data.JsonWriter({
			encode: true,  //false // <-- don't return encoded JSON -- causes Ext.Ajax#request to send data using jsonData config rather than HTTP params
			writeAllFields: true
		}); //writer
		
		var fields=[];
		var fieldParams=['allowBlank', 'type', 'dateFormat'];

		for(var i=0;i< this.initialConfig.columns.length;i++) {
			var c=this.initialConfig.columns[i];
			var f={name: c.dataIndex};
			for(var fp=0;fp<fieldParams.length;fp++) {
				var name=fieldParams[fp];
				if (!(c[name]===undefined) ) f[name]=c[name];
			}
			fields.push(f);
		};
		var reader = new Ext.data.JsonReader({
			totalProperty: 'total',
			successProperty: 'success',
			idProperty: 'id',	//TODO - uzywac initialConfig
			messageProperty: 'message',
			root: 'data'
			}, fields
		);

		var storeConfig = {
			restful: true,	 // <-- This Store is RESTful
			autoLoad: true,
			proxy: proxy,
			reader: reader,
			autoSave: false,
			sortInfo: this.initialConfig.sortInfo,
			writer: writer	// <-- plug a DataWriter into the store just as you would a Reader
		}; //storeConfig
		if (this.initialConfig.grouping) {
			var grouping=this.initialConfig.grouping;
			if (grouping.groupField) storeConfig.groupField=grouping.groupField;
			var store = new Ext.data.GroupingStore(storeConfig);
		} else var store = new Ext.data.Store(storeConfig);

		var buttons = {
			add: {
				text: 'Dodaj',
				handler: onAdd.createDelegate(this)
			},
			remove:  {
				text: 'Usuń',
				handler: onDelete.createDelegate(this)
			}, 
			save: {
				text: 'Zapisz',
				handler: onSave.createDelegate(this)
			}
		};

		var config = {
			store: store,
			clicksToEdit: 1,	//wazne!!!
			tbar: [],
			viewConfig: {
				forceFit: true
			}
		}; //config
		//TODO to jest do przerobiuenia
		if (this.initialConfig.viewConfig) config.viewConfig= Ext.apply(config.viewConfig,this.initialConfig.viewConfig);
		
		if (this.initialConfig.grouping) {
			config.view = new Ext.grid.GroupingView(config.viewConfig);
		};
//		else{
//			config.viewConfig ={forceFit: true};
//		}

		if (!this.initialConfig.RESTbuttons) this.initialConfig.RESTbuttons=['add','remove','save'];
		
		for (var n=0;n<this.initialConfig.RESTbuttons.length;n++) {
			config.tbar.push(buttons[this.initialConfig.RESTbuttons[n]]);
			if (n<this.initialConfig.RESTbuttons.length-1) config.tbar.push('-');
		}
		
		Ext.apply(this, Ext.apply(this.initialConfig, config));

		mk.RestfulEditorGridPanel.superclass.initComponent.apply(this, arguments);
	}, //initComponent
	remoteFilter: function(filter) {
		this.proxy.remoteFilter = filter;
	}
}); //Ext.extend

Ext.reg('restfuleditorgridpanel',mk.RestfulEditorGridPanel);
Ext.ns('mk');

mk.ProgressWindow = Ext.extend(Ext.Window, {
	initComponent: function() {
		var pbar = new Ext.ProgressBar({text:'0%',padding: 10,margin:10});
		this.progressbar = pbar;

		var btAbort = new Ext.Button({text: 'Przerwij',scope: this, handler: function(){
				this.checkTaskStatusJob.cancel();
				Ext.Ajax.request({url:'task/'+this.task+'/abort/',scope:this,callback: function() {this.hide();} });//TODO obsluga bledow?
			}
		});

		var btBackground = new Ext.Button({text: 'W tle',scope: this, handler: function(){
				this.checkTaskStatusJob.cancel();
				/*
				Ext.Msg.show({title:'Powiadomienie',msg:'Czy wysłac e-mail z powiadomieniem o wykonaniu zadania?',buttons:Ext.Msg.YESNO, icon: Ext.MessageBox.QUESTION, fn: function(button,text,opt) {
					if (button=='yes')
						Ext.Ajax.request({url:'task/'+this.task+'/notify/'});
				},scope:this});
				*/
				this.hide();
			}
		});

		var config = {
			width: 600,
			minWidth:500,
			maxWidth:800,
			height: 160,
			minHeight: 100,
			maxHeight: 200,
			stateful: false,
			title: 'Postęp',
			padding: 5,
			border: false,
			modal: true,
			//resizable: false,
			closable: true,
			closeAction: 'hide',
			items: [
				{ 
					border: false,
					itemId: 'message',
					html: '<p class="x-window-mc" style="padding: 0px 0px 15px 0px"> Trwa wykonywanie zadania </p>'
					//html: '<p class="x-window-mc"> Trwa wykonywanie zadania </p>',
				},
				pbar
			],
			buttons: [ btAbort, btBackground ],
			buttonAlign: 'center'

		};
		Ext.apply(this, Ext.apply(this.initialConfig, config));

		this.checkTaskStatusJob = new Ext.util.DelayedTask(
			function() {
				Ext.Ajax.request({
					url:'task/'+this.task+'/status/',
					success: function (form, action) {
						//TODO zobaczyc, ktore jest ok i wywalic drugie
						var result = Ext.util.JSON.decode(form.responseText);
						if (result.status == 'DONE') {
							this.successCallback(form,action);
							this.hide();
						} else {
							this.updateProgress(result.progress, result.msg);
							if (result.status == 'WAITING' || result.status == 'RUNNING') this.checkTaskStatusJob.delay(1000);
						}
					},
					failure: function() {
						this.hide();
						this.failureCallback.apply(this);
					},
//					params: {tempTableId: tempTableId},	//nie wiem, po co to tu jest...
					scope: this
				});
			}
		,this);

		mk.ProgressWindow.superclass.initComponent.apply(this, arguments);
	},//initComponent
	updateProgress: function(value,text) {
		if (value>1) value=1;
		if (value<0) value=0;
		this.progressbar.updateProgress(value,Math.round(value*100)+'%');
		msg=this.getComponent('message');
		msg.update('<p class="x-window-mc" style="padding: 0px 0px 15px 0px">'+text+'</p>');
		

	},
	show: function(config){
		this.task=config.task;
		this.successCallback=config.success;
		this.failureCallback=config.failure;
		this.checkTaskStatusJob.delay(1000);
		mk.ProgressWindow.superclass.show.apply(this);
		this.updateProgress(0,'Trwa przygotowanie danych');
	}

}); //extend

Ext.reg('progresswindow',mk.ProgressWindow);
Ext.ns('mk');

mk.IFrameWindow = Ext.extend(Ext.Window, {
	initComponent: function() {
		var config = {
			width: 800,
			height: 600,
//			padding: 5,
//			border: false,
//			modal: false,
//			resizeable: true,
//			closable: true,
			buttons: [{text:'Close',handler: function() { this.hide();},scope:this}],
			buttonAlign: 'center'

		};
		this.iframe = Ext.DomHelper.append(document.body, {tag: 'iframe', frameBorder: 0, width: '100%', height: '100%'}); 
		this.appended = false;
		//this.iframe = Ext.DomHelper.append(document.body, {tag: 'iframe', id: 'frame-' + winId, frameBorder: 0, width: '100%', height: '100%'}); 

		Ext.apply(this, Ext.apply(this.initialConfig, config));

		mk.IFrameWindow.superclass.initComponent.apply(this, arguments);
	},//initComponent
	updateHtml: function(html) {
		this.iframe.contentWindow.document.body.innerHTML=html;
		//mk.IFrameWindow.superclass.update.apply(this);
		//this.doLayout(false,true);
	},
	show: function(html){
		mk.IFrameWindow.superclass.show.apply(this);
		//this.doLayout();
		if (!this.appended) {
			this.body.appendChild(this.iframe);
			this.appended=true;
		}
		//this.doLayout();
		if (html) this.updateHtml(html);
		//this.doLayout();
	}


}); //extend

Ext.reg('iframewindow',mk.IFrameWindow);
/*!
 * Ext JS Library 3.4.0
 * Copyright(c) 2006-2011 Sencha Inc.
 * licensing@sencha.com
 * http://www.sencha.com/license
 */
/**
 * Ext.App
 * @extends Ext.util.Observable
 * @author Chris Scott
 */
Ext.App = function(config) {
    this.views = [];
    
    this.initStateProvider();
    
    Ext.apply(this, config);
    
    if (!this.api.actions) {
        this.api.actions = {};
    }
    
    Ext.onReady(this.onReady, this);
    
    Ext.App.superclass.constructor.apply(this, arguments);
};

Ext.extend(Ext.App, Ext.util.Observable, {

    /***
     * response status codes.
     */
    STATUS_EXCEPTION :          'exception',
    STATUS_VALIDATION_ERROR :   "validation",
    STATUS_ERROR:               "error",
    STATUS_NOTICE:              "notice",
    STATUS_OK:                  "ok",
    STATUS_HELP:                "help",

    /**
     * @cfg {Object} api
     * remoting api.  should be defined in your own config js.
     */
    api: {
        url: null,
        type: null,
        actions: {}
    },

    // private, ref to message-box Element.
    msgCt : null,

    // @protected, onReady, executes when Ext.onReady fires.
    onReady : function() {
        // create the msgBox container.  used for App.setAlert
        this.msgCt = Ext.DomHelper.insertFirst(document.body, {id:'msg-div'}, true);
        this.msgCt.setStyle('position', 'absolute');
        this.msgCt.setStyle('z-index', 9999);
        this.msgCt.setWidth(300);
    },

    initStateProvider : function() {
        /*
         * set days to be however long you think cookies should last
         */
        var days = '';        // expires when browser closes
        if(days){
            var date = new Date();
            date.setTime(date.getTime()+(days*24*60*60*1000));
            var exptime = "; expires="+date.toGMTString();
        } else {
            var exptime = null;
        }

        // register provider with state manager.
        Ext.state.Manager.setProvider(new Ext.state.CookieProvider({
            path: '/',
            expires: exptime,
            domain: null,
            secure: false
        }));
    },

    /**
     * registerView
     * register an application view component.
     * @param {Object} view
     */
    registerView : function(view) {
        this.views.push(view);
    },

    /**
     * getViews
     * return list of registered views
     */
    getViews : function() {
        return this.views;
    },

    /**
     * registerActions
     * registers new actions for API
     * @param {Object} actions
     */
    registerActions : function(actions) {
        Ext.apply(this.api.actions, actions);
    },

    /**
     * getAPI
     * return Ext Remoting api
     */
    getAPI : function() {
        return this.api;
    },

    /***
     * setAlert
     * show the message box.  Aliased to addMessage
     * @param {String} msg
     * @param {Bool} status
     */
    setAlert : function(status, msg) {
        this.addMessage(status, msg);
    },

    /***
     * adds a message to queue.
     * @param {String} msg
     * @param {Bool} status
     */
    addMessage : function(status, msg) {
        var delay = 3;    // <-- default delay of msg box is 1 second.
        if (status == false) {
            delay = 5;    // <-- when status is error, msg box delay is 3 seconds.
        }
        // add some smarts to msg's duration (div by 13.3 between 3 & 9 seconds)
        delay = msg.length / 13.3;
        if (delay < 3) {
            delay = 3;
        }
        else if (delay > 9) {
            delay = 9;
        }

        this.msgCt.alignTo(document, 't-t');
        Ext.DomHelper.append(this.msgCt, {html:this.buildMessageBox(status, String.format.apply(String, Array.prototype.slice.call(arguments, 1)))}, true).slideIn('t').pause(delay).ghost("t", {remove:true});
    },

    /***
     * buildMessageBox
     */
    buildMessageBox : function(title, msg) {
        switch (title) {
            case true:
                title = this.STATUS_OK;
                break;
            case false:
                title = this.STATUS_ERROR;
                break;
        }
        return [
            '<div class="app-msg">',
            '<div class="x-box-tl"><div class="x-box-tr"><div class="x-box-tc"></div></div></div>',
            '<div class="x-box-ml"><div class="x-box-mr"><div class="x-box-mc"><h3 class="x-icon-text icon-status-' + title + '">', title, '</h3>', msg, '</div></div></div>',
            '<div class="x-box-bl"><div class="x-box-br"><div class="x-box-bc"></div></div></div>',
            '</div>'
        ].join('');
    },

    /**
     * decodeStatusIcon
     * @param {Object} status
     */
    decodeStatusIcon : function(status) {
        iconCls = '';
        switch (status) {
            case true:
            case this.STATUS_OK:
                iconCls = this.ICON_OK;
                break;
            case this.STATUS_NOTICE:
                iconCls = this.ICON_NOTICE;
                break;
            case false:
            case this.STATUS_ERROR:
                iconCls = this.ICON_ERROR;
                break;
            case this.STATUS_HELP:
                iconCls = this.ICON_HELP;
                break;
        }
        return iconCls;
    },

    /***
     * setViewState, alias for Ext.state.Manager.set
     * @param {Object} key
     * @param {Object} value
     */
    setViewState : function(key, value) {
        Ext.state.Manager.set(key, value);
    },

    /***
     * getViewState, aliaz for Ext.state.Manager.get
     * @param {Object} cmd
     */
    getViewState : function(key) {
        return Ext.state.Manager.get(key);
    },

    /**
     * t
     * translation function.  needs to be implemented.  simply echos supplied word back currently.
     * @param {String} to translate
     * @return {String} translated.
     */
    t : function(words) {
        return words;
    },

    handleResponse : function(res) {
        if (res.type == this.STATUS_EXCEPTION) {
            return this.handleException(res);
        }
        if (res.message.length > 0) {
            this.setAlert(res.status, res.message);
        }
    },

    handleException : function(res) {
        Ext.MessageBox.alert(res.type.toUpperCase(), res.message);
    }
});/*!
 * Ext JS Library 3.4.0
 * Copyright(c) 2006-2011 Sencha Inc.
 * licensing@sencha.com
 * http://www.sencha.com/license
 */
Ext.ns('Ext.ux.form');

Ext.ux.form.SearchField = Ext.extend(Ext.form.TwinTriggerField, {
    initComponent : function(){
        Ext.ux.form.SearchField.superclass.initComponent.call(this);
        this.on('specialkey', function(f, e){
            if(e.getKey() == e.ENTER){
                this.onTrigger2Click();
            }
        }, this);
    },

    validationEvent:false,
    validateOnBlur:false,
    trigger1Class:'x-form-clear-trigger',
    trigger2Class:'x-form-search-trigger',
    hideTrigger1:true,
    width:180,
    hasSearch : false,
    paramName : 'query',

    onTrigger1Click : function(){
        if(this.hasSearch){
            this.el.dom.value = '';
            var o = {start: 0};
            if (!this.store) this.store = this.grid.getStore();
            this.store.baseParams = this.store.baseParams || {};
            delete this.store.baseParams[this.paramName];
            this.store.reload({params:o});
            this.triggers[0].hide();
            this.hasSearch = false;
        }
    },

    onTrigger2Click : function(){
        var v = this.getRawValue();
        if(v.length < 1){
            this.onTrigger1Click();
            return;
        }
        var o = {start: 0};
        if (!this.store) this.store = this.grid.getStore();
        this.store.baseParams = this.store.baseParams || {};
        this.store.baseParams[this.paramName] = v;
        this.store.reload({params:o});
        this.hasSearch = true;
        this.triggers[0].show();
    }
});
