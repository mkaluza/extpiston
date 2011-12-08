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
