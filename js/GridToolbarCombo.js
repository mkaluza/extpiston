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


