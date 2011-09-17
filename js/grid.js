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
				xtype: formClass		//TODO accept form definition as well, not only xtype (as with editWindow)
			}
		}
		//if (this.editWindow) editWindow = this.editWindow	//TODO po co to?

		if (this.initialConfig.windowClass) editWindow = {xtype: this.initialConfig.windowClass}
		if (this.initialConfig.editWindow) editWindow = this.initialConfig.editWindow

		this.showWindow = function(grid, showRec, params) {
			editWindow.baseUrl = grid.store.url;
			var ew = Ext.apply({}, params, editWindow);
			var win = new Ext.create(ew,'window');
			var frm = win.findByType('form')[0].getForm();
			frm.origUrl = frm.url;
			frm.url = grid.store.url;
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
				handler: function(button, event, params) {	//button and event are params passed to the action when it's clicked as a toolbar button or menu item, params is my own
					this.showWindow(this,false, params);
				},
				name: 'add',
			},
			edit: {
				text: "Edytuj",
				width: 90,
				handler: function(button, event, params) {
					var rec = this.getSelectionModel().getSelected();
					if (rec) {
						this.showWindow(this,true);
					} else Ext.MessageBox.alert('Błąd','Proszę wybrać pozycję');

				},
				name: 'edit',
			}	
			      //TODO delete action
		}

		//add any actions given by the user to our actions
		this.actions = new Ext.util.MixedCollection();

		var actions_count = 0;
		if (this.initialConfig.actions) {
			var key,act;
			//for each([key, act] in Iterator(this.initialConfig.actions)) {		//TODO can't use this - Google Chrome does not support it for compatibility with safari (fail...)
			for(var i = 0;i < this.initialConfig.actions.length; i++) {
				//TODO jesli this.iC.actions jest obiektem (czyli key będzie stringiem i będzie nazwą predefiniowanej akcji), to robić apply/applyIf z predefiniowanymi akcjami jakoś (nadpisując lub nie) - do ustalenia, w którą stronę
				act = this.initialConfig.actions[i];
				key = i.toString();
				if (typeof(act) == "string") {
					key = act;
					if (act in _actions) act = _actions[act]		//use default action by that name
					else continue		//TODO error message
				}
				else if (act.name) key = act.name;

				if (!(act instanceof Ext.Action)) {
					//if it's an object, create Ext.Action (assume it's a config object), else do nothing
					act.scope = act.scope || this;
					act.width = act.width || 90;
					act = new Ext.Action(act);
				}
				actions_count++;
				this.actions.add(key, act);
				if (act.initialConfig.name == 'edit') {
					var action = act;
					this.on('celldblclick',function(grid, rowIndex, columnIndex, event){
						grid.getSelectionModel().selectRow(rowIndex);
						action.execute();
					});
				}
			}
		};

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
				menu.add(action);
				if (index<length-1) this.tbar.push('-');
			}, this);
		}

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
		//TODO kiedy robić tą inicjalizację z akcjami? przed czy po superclass.initComponent??

		ExtPiston.grid.GridPanel.superclass.initComponent.apply(this, arguments);

	} //initComponent
});
Ext.reg('extpiston.grid',ExtPiston.grid.GridPanel);

