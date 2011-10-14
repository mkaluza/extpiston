// vim: fileencoding=utf-8
// vim: filetype=javascript

Ext.namespace('ExtPiston.form');

ExtPiston.form.FormPanel = Ext.extend(Ext.form.FormPanel, {
	initComponent: function() {
		var config = {
			bodyStyle:'padding:5px 5px 0',
			bubbleEvents: ['cancel','save'],
			defaults: {anchor: '100%'},
			frame: true,
			items: [],
			labelWidth: 100,
			closeOnCreate: true,
			trackResetOnLoad: true,
			loadMask: true
		};

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
	}, //initComponent
	getBaseUrl: function(param1) {
		var pk = this.getPk();
		if (pk != null) {
			return urljoin(url,pk);
		}
		else
			return url;
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
	},
	actionComplete: function(form, action) {
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
	}
});

Ext.reg('extpiston.form',ExtPiston.form.FormPanel);
