// vim: fileencoding=utf-8
// vim: filetype=javascript

Ext.namespace('ExtPiston.form');

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
				for (var name in this.initialConfig.fields)
					if (typeof(name)=="string")
						config.items.push(this.nsformFields[name]);
						//TODO handle field definitions
			} else {
				for (var name in this.ns.formFieldNames) {
					name = this.ns.formFieldNames[name];
					var field = this.ns.formFields[name];
					if (field) config.items.push(field);
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
				App.setAlert(false, 'Błąd serwera');
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
