// vim: set fileencoding=utf-8

Ext.namespace("ExtPiston.data");
ExtPiston.data.JsonStore = Ext.extend(Ext.data.JsonStore, {
	autoSave: false,
	messageProperty: 'message',
	root: 'data',
	restful: true,
	method: 'GET',
	idProperty: 'id',
	constructor: function(config) {
		if (config.writeable) {
			var writer = new Ext.data.JsonWriter(config);
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
				App.setAlert(false, _("Wystąpił błąd:  {0} {1}").format(response.status, response.statusText));
			}
		};

		Ext.apply(config, {listeners: listeners});

		ExtPiston.data.JsonStore.superclass.constructor.call(this, config);
	}
});

Ext.reg('extpiston.jsonstore', ExtPiston.data.JsonStore);

