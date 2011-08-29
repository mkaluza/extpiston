Ext.namespace('ExtPiston.grid');

ExtPiston.grid.GridPanel = Ext.extend(Ext.grid.GridPanel, {
	initComponent:function() {
		var formClass = this.initialConfig.formClass || this.namespace.toLowerCase()+'.form';

		var editWindow = {
			title: "",
			xtype: 'window',
			autoHeight: true,
			width: 400,
			items: {
				xtype: formClass
			}
		}
		//if (this.editWindow) editWindow = this.editWindow	//TODO po co to?

		if (this.initialConfig.windowClass) editWindow = {xtype: this.initialConfig.windowClass}
		if (this.initialConfig.editWindow) editWindow = this.initialConfig.editWindow

		this.showWindow = function(grid, showRec) {
			editWindow.baseUrl = grid.store.url;
			var win = new Ext.create(editWindow,'window');
			if (showRec) {
				var rec = grid.getSelectionModel().getSelected();
				if (rec) win.findByType(formClass)[0].getForm().loadRecord(rec);
			};
			win.show();
			win.on('close',grid.store.reload.createDelegate(grid.store));
		};

		var _actions = {
			add : {
				text: "Nowy",
				width: 90,
				handler: function() {
					this.showWindow(this,false);
				},
				name: 'add',
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
				name: 'edit',
			}
		}

		//add any actions given by the user to our actions
		this.actions = new Ext.util.MixedCollection();

		if (this.initialConfig.actions) {
			var key,act;
			for each([key, act] in Iterator(this.initialConfig.actions)) {
				//TODO jesli this.iC.actions jest obiektem (czyli key bêdzie stringiem i bêdzie nazw± predefiniowanej akcji), to robiæ apply/applyIf z predefiniowanymi akcjami jako¶ (nadpisuj±c lub nie) - do ustalenia, w któr± stronê
				if (typeof(act) == "string") {
					key = act;
					if (act in _actions) act = _actions[act]		//use default action by that name
					else continue		//TODO error message
				}

				if (!(act instanceof Ext.Action)) {
					//if it's an object, create Ext.Action (assume it's a config object), else do nothing
					act.scope = act.scope || this;
					act = new Ext.Action(act);
				}
				this.actions.add(key, act);
				if (act.initialConfig.name == 'edit')
					this.on('celldblclick',function(grid, rowIndex, columnIndex, event){
						grid.getSelectionModel().selectRow(rowIndex);
						act.execute();
					});
			}
		};

		//initiate toolbar
		if (this.actions.length>0)
			if (!this.tbar) {
				this.tbar = [];
			}
			else this.tbar.push('-');

		//initiate context menu
		var menu = new Ext.menu.Menu();
		this.menu = menu;
		//co¶ jest nei tak z kolejno¶ci± odpalania tych zdarzeñ, bo tak dzia³a, a jako osobne metody nie dzia³a
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
			menu.add(action);
			if (index<length-1) this.tbar.push('-');
		}, this);
		this.actions.disable = function() {
			this.each(function(action,index,length) {
				action.disable();
			});
		}
		this.actions.enable = function() {
			this.each(function(action,index,length) {
				action.enable();
			});
		}
		//TODO kiedy robiæ t± inicjalizacjê z akcjami? przed czy po superclass.initComponent??

		ExtPiston.grid.GridPanel.superclass.initComponent.apply(this, arguments);

	} //initComponent
});
Ext.reg('extpiston.grid',ExtPiston.grid.GridPanel);

