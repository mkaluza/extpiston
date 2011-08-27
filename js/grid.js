Ext.namespace('ExtPiston.grid');

ExtPiston.grid.GridPanel = Ext.extend(Ext.grid.GridPanel, {
	initComponent:function() {
		var _actions = {
			add : {
				text: "Nowy",
				width: 90,
				handler: function() {
					this.showWindow(this,false);
				},
			},
			edit: {
				text: "Edytuj",
				width: 90,
				handler: function(a,b,c,d) {
					var rec = this.getSelectionModel().getSelected();
					if (rec) {
						this.showWindow(this,true);
					} else Ext.MessageBox.alert('B³±d','Proszê wybraæ pozycjê');

				},
			}
		}

		//add any actions given by the user to our actions
		var actions=[]
		if (this.initialConfig.actions) {
			for each([key, act] in Iterator(this.initialConfig.actions)) {
				if (typeof(act) == "string") {
					if (act in _actions) act = _actions[act]		//use default action by that name
					else continue		//TODO error message
				}

				if (!(act instanceof Ext.Action)) {
					//if it's an object, create Ext.Action (assume it's a config object), else do nothing
					act.scope = act.scope || this;
					act = new Ext.Action(act);
				}
				actions.push(act)
			}
		};

		//initiate toolbar
		if (actions.length>0)
			if (!this.tbar) {
				this.tbar = [];
			}
			else this.tbar.push('-');

		//initiate context menu
		var menu = new Ext.menu.Menu();
		this.on('rowcontextmenu', function(grid, index, event){
			grid.getSelectionModel().selectRow(index);
		});

		this.on('contextmenu', function(event){
			event.stopEvent();
			menu.showAt(event.xy);
		});

		for each([index, action] in Iterator(actions)) {
			this.tbar.push(action);
			menu.add(action);
			if (index<actions.length-1) this.tbar.push('-');
		}
		//TODO kiedy robiæ t± inicjalizacjê z akcjami? przed czy po superclass.initComponent??

		ExtPiston.grid.GridPanel.superclass.initComponent.apply(this, arguments);

	} //initComponent
});
Ext.reg('extpiston.grid',ExtPiston.grid.GridPanel);

