Ext.namespace('ExtPiston.grid');

ExtPiston.grid.Grid = {
	loadMask: true,
	preInit: function preInit() {
	},
	postInit: function postInit() {
	},
	initActionBar: function initActionBar() {
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
				if (index<length-1) this.tbar.push('-');
				if (action == '->') return;
				menu.add(action);
			}, this);
		}
	},
	setBaseUrl: function(baseUrl) {
		//TODO zrobić to lepiej... dużo lepiej...
		this.origUrl = this.origUrl || this.store.url;
		if (!(this.childUrl || this.url) ) console.log('error: childUrl not set in {0} {1}'.format(this.xtype, this.name));

		var url = baseUrl+'/' + this.childUrl || this.url;
		this.store.url = url;		//so that we don't need to get grid.store.proxy.url, but only grid.store.url
		this.store.proxy.setUrl(url,true);
	},
	getBaseUrl: function getBaseUrl(rec) {
		var rec = rec || this.getSelectionModel().getSelected();
		if (!rec) return null;
		return urljoin(this.origUrl || this.store.url, rec.id);
	},
	setDynamicBaseUrl: function(store) {
		//if it's a function, call it to get current base url
		//if (typeof(this.initialConfig.baseUrl) == "function") this.store.proxy.setUrl(this.initialConfig.baseUrl()+'/{{ name|lower }}', true);
		if (typeof(this.initialConfig.baseUrl) == "function") this.store.proxy.setUrl(this.initialConfig.baseUrl()+'/' + this.childUrl, true);
	},
	adjustHeightToFitMaxRows: false,				//CONFIG
	adjustHeight: function adjustHeight() {
		if (!this.adjustHeightToFitMaxRows) return		//CONFIG
		if (!this.el) return;
		var scr = Ext.query('div.x-grid3-scroller', this.el.dom)[0];
		var rows = Ext.query('div.x-grid3-row', scr)
		rows = Array.prototype.slice.call(rows,0);
		//var els = Ext.query('div.x-grid3-cell-inner', scr);
		if (!rows.length) return;

		var tb;

		for(var i = 0; i < this.toolbars.length; i++) {
			tb = this.toolbars[i].pageSize;
			if (tb) break;
		}
		if (!tb) return;
		//var dh = scr.clientHeight - this.bottomToolbar.pageSize * (rows[0].clientHeight+2);
		var dh = scr.clientHeight - tb * (rows[0].clientHeight+2);
		this.setHeight(this.getHeight()-dh);
	}
}

ExtPiston.grid.GridPanel = Ext.extend(
	Ext.extend(Ext.grid.GridPanel, ExtPiston.grid.Grid),
	{
	initComponent:function() {
		this.namespace = this.namespace || '';
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
		};

		if (this.initialConfig.editFormConfig) Ext.apply(editWindow.items, this.initialConfig.editFormConfig);
		if (this.initialConfig.editForm) editWindow.items = this.initialConfig.editForm;

		if (this.initialConfig.windowClass) editWindow = {xtype: this.initialConfig.windowClass};
		if (this.initialConfig.editWindowConfig) Ext.apply(editWindow, this.initialConfig.editWindowConfig);
		if (this.initialConfig.editWindow) editWindow = this.initialConfig.editWindow;

		this.showWindow = function(grid, showRec, params) {
			editWindow.baseUrl = grid.store.url;
			var ew = Ext.apply({}, params, editWindow);
			var win = new Ext.create(ew,'window');
			var frmp = win.findByType('form')[0];		//TODO switch to using ref
			frmp.closeOnSave = this.initialConfig.closeOnSave;

			frmp.setBaseUrl(grid.store.url);
			if (showRec) {
				var rec = grid.getSelectionModel().getSelected();
				if (rec) win.findByType('form')[0].getForm().loadRecord(rec);		//TODO 'form' instead of formClass to make it more generic- a good way would be to add ref to main form...
			};
			if (frmp.initialConfig.title && !win.initialConfig.title) win.setTitle(frmp.initialConfig.title);
			win.show();
			win.on('close',grid.store.reload.createDelegate(grid.store));
			frmp.on('cancel',win.close.createDelegate(win));
			win.on('beforeclose', this.beforeClose, frmp);
		};

		var _actions = {
			add : {
				text: _("Nowy"),
				handler: function(button, event, params) {	//button and event are params passed to the action when it's clicked as a toolbar button or menu item, params is my own
					this.showWindow(this,false, params);
				},
				name: 'add'
			},
			edit: {
				text: _("Edytuj"),
				handler: function(button, event, params) {
					var rec = this.getSelectionModel().getSelected();
					if (rec) {
						this.showWindow(this,true);
					} else Ext.MessageBox.alert(_('Błąd'),_('Proszę wybrać pozycję'));
				},
				name: 'edit'
			},
			remove: {
				text: _("Usuń"),
				handler: function(button, event, params) {
					var rec = this.getSelectionModel().getSelected();
					if (rec) {
						if (confirm(_("Czy jesteś pewien, że chcesz usunąć wybraną pozycję?"))) {
							this.store.remove(rec);
							this.store.save();
						}
					} else Ext.MessageBox.alert(_('Błąd'),_('Proszę wybrać pozycję'));
				},
				name: 'remove'
			}
		};

		//add any actions given by the user to our actions
		this.actions = processActions(this.initialConfig.actions, _actions, this);

		//if defined, bind edit action with double click event
		var editAction = this.actions.get('edit');
		if (editAction) {
			this.on('celldblclick',function(grid, rowIndex, columnIndex, event){
				grid.getSelectionModel().selectRow(rowIndex);
				if (!editAction.isDisabled()) editAction.execute();
			});
		}

		//initiate toolbar and context menu if there are any actions defined
		this.initActionBar();

		//TODO kiedy robić tą inicjalizację z akcjami? przed czy po superclass.initComponent??

		if (this.initialConfig.filterBy) {
			var tb = this.tbar = this.tbar || [];
			tb.push(new Ext.ux.form.SearchField({paramName: 'filter__'+this.initialConfig.filterBy, store: this.initialConfig.store, grid: this}));
		}

		this.on('viewready', this.adjustHeight);
		this.store.on('load', this.adjustHeight, this);
		ExtPiston.grid.GridPanel.superclass.initComponent.apply(this, arguments);

		this.relayEvents(this.getSelectionModel(),['selectionchange','rowselect']);

		if (this.initialConfig.baseUrl) {				//if a component handles a related field, baseUrl is added to url
			var baseUrl = this.initialConfig.baseUrl;
			if (typeof(baseUrl) == "string")
				this.setBaseUrl(baseUrl);
			//TODO to zrobić jako eventy, bo jak jest funkcja, to znaczy, że ma być dynamiczne
			//else if (typeof(baseUrl) == "function")
			//	config.store.url = baseUrl()+'/'+config.store.url
			//	else
			//		throw "{{app_label|title}}.{{name}}.gridInit: invalid baseUrl: "+baseUrl;
		}
		//dynamic base url setting
		this.postInit();
	}, //initComponent
	beforeClose: function(panel) {
		if (this.form.isDirty())
			return confirm(_('Formularz zawiera niezapisane dane. Czy na pewno chcesz zamknąć okno?'));
	}
});

Ext.reg('extpiston.grid',ExtPiston.grid.GridPanel);

ExtPiston.grid.EditorGridPanel = Ext.extend(
	Ext.extend(Ext.grid.EditorGridPanel, ExtPiston.grid.Grid),
	{
	initComponent:function() {
		var _actions = {
			add: {
				text: _('Dodaj'),name: 'add',
				handler: function add(btn, ev) {
					//TODO
					var rec = {};
					var store = this.getStore();

					//what was this for??
					/*
					for(var i=0; i<store.fields.keys.length; i++) {
						var f = store.fields.keys[i];
						if (f != store.reader.meta.idProperty) rec[f]='';
					}
					*/
					//initialize default values	TODO reocrdType should do it by itself?...
					store.fields.each(function(f) {
						if (f.defaultValue != "")
							rec[f.name]=f.defaultValue;
					});
					var u = new store.recordType(rec);	//nie trzeba, ale wtedy cały się podświetla i jest wyraźniej
					u.markDirty();
					this.stopEditing();
					store.insert(0, u);
					//find first editable cell
					var cm = this.colModel;
					var editableCells = cm.getColumnsBy(function checkIfEditable(c, i) {
						return c.editable;
						return this.isCellEditable(0,i);	//this would return true if column has editor property set, but editable==false and we don't want it
					});
					if (editableCells.length > 0)
						this.startEditing(0,editableCells[0].id);
					this.fireEvent('addItem', this, u);
				}
			},
			remove:  {
				text: _('Usuń'), name: 'remove',
				handler: function remove() {
					var sm = this.getSelectionModel();
					var rec = sm.getSelectedCell();
					var store = this.getStore();
					if (!rec) {
						return false;
					}
					store.removeAt(rec[0]);
					var cnt = store.getCount();
					if (cnt > 0) {
						if (cnt<=rec[0]) sm.select(cnt-1,1);
						else sm.select(rec[0],1);
					}
					this.fireEvent('removeItem', this, rec);
				}
			},
			save: {
				text: _('Zapisz'), name: 'save',
				handler: function save(btn, ev) {
					this.getStore().save();
				}
			}
		};

		this.actions = processActions(this.initialConfig.RESTbuttons || ['add','remove','save'], _actions, this);

		this.initActionBar();

		ExtPiston.grid.EditorGridPanel.superclass.initComponent.apply(this, arguments);

		this.relayEvents(this.getSelectionModel(),['selectionchange', 'cellselect']);
		this.addEvents(['addItem','removeItem']);
		this.postInit();
	}	//initComponent
});
Ext.reg('extpiston.editorgrid',ExtPiston.grid.EditorGridPanel);
