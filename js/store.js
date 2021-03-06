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

