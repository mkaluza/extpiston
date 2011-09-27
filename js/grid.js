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
				xtype: formClass,		//TODO accept form definition as well, not only xtype (as with editWindow)
				header: false
			}
		}
		//if (this.editWindow) editWindow = this.editWindow	//TODO po co to?

		if (this.initialConfig.windowClass) editWindow = {xtype: this.initialConfig.windowClass}
		if (this.initialConfig.editWindow) editWindow = this.initialConfig.editWindow
		if (this.initialConfig.editWindowConfig) Ext.apply(editWindow, this.initialConfig.editWindowConfig);

		this.showWindow = function(grid, showRec, params) {
			editWindow.baseUrl = grid.store.url;
			var ew = Ext.apply({}, params, editWindow);
			var win = new Ext.create(ew,'window');
			var frmp = win.findByType('form')[0];
			var frm = frmp.getForm();
			frm.origUrl = frm.url;
			frm.url = grid.store.url;
			if (showRec) {
				var rec = grid.getSelectionModel().getSelected();
				if (rec) win.findByType('form')[0].getForm().loadRecord(rec);		//TODO 'form' instead of formClass to make it more generic- a good way would be to add ref to main form...
			};
			if (frmp.initialConfig.title && !win.initialConfig.title) win.setTitle(frmp.initialConfig.title);
			win.show();
			win.on('close',grid.store.reload.createDelegate(grid.store));
			frmp.on('cancel',win.close.createDelegate(win));
		};

		var _actions = {
			add : {
				text: "Nowy",
				handler: function(button, event, params) {	//button and event are params passed to the action when it's clicked as a toolbar button or menu item, params is my own
					this.showWindow(this,false, params);
				},
				name: 'add',
			},
			edit: {
				text: "Edytuj",
				handler: function(button, event, params) {
					var rec = this.getSelectionModel().getSelected();
					if (rec) {
						this.showWindow(this,true);
					} else Ext.MessageBox.alert('Błąd','Proszę wybrać pozycję');

				},
				name: 'edit',
			},
			delete: {
				text: "Usuń",
				handler: function(button, event, params) {
					var rec = this.getSelectionModel().getSelected();
					if (rec) {
						if (confirm("Czy jesteś pewien, że chcesz usunąć wybraną pozycję?")) {
							this.store.remove(rec);
							this.store.save();
						}
					} else Ext.MessageBox.alert('Błąd','Proszę wybrać pozycję');

				},
				name: 'delete',
			}
		}

		//add any actions given by the user to our actions
		this.actions = processActions(this.initialConfig.actions, _actions, this);

		//if defined, bind edit action with double click event
		var editAction = this.actions.get('edit')
		if (editAction) {
			this.on('celldblclick',function(grid, rowIndex, columnIndex, event){
				grid.getSelectionModel().selectRow(rowIndex);
				editAction.execute();
			});
		}

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

