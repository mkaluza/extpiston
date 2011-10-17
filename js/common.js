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
			key = act;
			if (act in _actions) act = _actions[act]		//use predefined action with that name
			else  {
				console.log('invalid action name: ' + key);
				continue;
			}
		}
		else if (act.name) {
			key = act.name;	//we can define new action and give it a name
			if (key in _actions && !(act instanceof Ext.Action)) {		//we are subclassing an existing action
				act = Ext.apply({}, act, _actions[key]);
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
			action.disable();
		});
	}

	actions.enable = function enable() {
		this.each(function(action,index,length) {
			action.enable();
		});
	}
	
	return actions;
};

Ext.onReady(function() {
	Ext.create = Ext.ComponentMgr.create.createInterceptor(function(config, defaultType) {
		var t = config.xtype || defaultType;
		if (!(t in this.types)) console.log("Type " + t + " not found");
	}, Ext.ComponentMgr);
})

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

String.prototype.format = function() {
	return String.format.apply(this, [this].concat(Ext.toArray(arguments)));
	//old
	var b = Ext.toArray(arguments);
	var a = [this].concat(b);
	var res = String.format.apply(this, a);
	return res;
}

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
