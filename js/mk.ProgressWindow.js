Ext.ns('mk');

mk.ProgressWindow = Ext.extend(Ext.Window, {
	initComponent: function() {
		var pbar = new Ext.ProgressBar({text:'0%',padding: 10,margin:10});
		this.progressbar = pbar;

		var btAbort = new Ext.Button({text: 'Przerwij',scope: this, handler: function(){
				this.checkTaskStatusJob.cancel();
				Ext.Ajax.request({url:'task/'+this.task+'/abort/',scope:this,callback: function() {this.hide();} });//TODO obsluga bledow?
			}
		});

		var btBackground = new Ext.Button({text: 'W tle',scope: this, handler: function(){
				this.checkTaskStatusJob.cancel();
				/*
				Ext.Msg.show({title:'Powiadomienie',msg:'Czy wysłac e-mail z powiadomieniem o wykonaniu zadania?',buttons:Ext.Msg.YESNO, icon: Ext.MessageBox.QUESTION, fn: function(button,text,opt) {
					if (button=='yes')
						Ext.Ajax.request({url:'task/'+this.task+'/notify/'});
				},scope:this});
				*/
				this.hide();
			}
		});

		var config = {
			width: 600,
			minWidth:500,
			maxWidth:800,
			height: 160,
			minHeight: 100,
			maxHeight: 200,
			stateful: false,
			title: 'Postęp',
			padding: 5,
			border: false,
			modal: true,
			//resizable: false,
			closable: true,
			closeAction: 'hide',
			items: [
				{ 
					border: false,
					itemId: 'message',
					html: '<p class="x-window-mc" style="padding: 0px 0px 15px 0px"> Trwa wykonywanie zadania </p>'
					//html: '<p class="x-window-mc"> Trwa wykonywanie zadania </p>',
				},
				pbar
			],
			buttons: [ btAbort, btBackground ],
			buttonAlign: 'center'

		};
		Ext.apply(this, Ext.apply(this.initialConfig, config));

		this.checkTaskStatusJob = new Ext.util.DelayedTask(
			function() {
				Ext.Ajax.request({
					url:'task/'+this.task+'/status/',
					success: function (form, action) {
						//TODO zobaczyc, ktore jest ok i wywalic drugie
						var result = Ext.util.JSON.decode(form.responseText);
						if (result.status == 'DONE') {
							this.successCallback(form,action);
							this.hide();
						} else {
							this.updateProgress(result.progress, result.msg);
							if (result.status == 'WAITING' || result.status == 'RUNNING') this.checkTaskStatusJob.delay(1000);
						}
					},
					failure: function() {
						this.hide();
						this.failureCallback.apply(this);
					},
//					params: {tempTableId: tempTableId},	//nie wiem, po co to tu jest...
					scope: this
				});
			}
		,this);

		mk.ProgressWindow.superclass.initComponent.apply(this, arguments);
	},//initComponent
	updateProgress: function(value,text) {
		if (value>1) value=1;
		if (value<0) value=0;
		this.progressbar.updateProgress(value,Math.round(value*100)+'%');
		msg=this.getComponent('message');
		msg.update('<p class="x-window-mc" style="padding: 0px 0px 15px 0px">'+text+'</p>');
		

	},
	show: function(config){
		this.task=config.task;
		this.successCallback=config.success;
		this.failureCallback=config.failure;
		this.checkTaskStatusJob.delay(1000);
		mk.ProgressWindow.superclass.show.apply(this);
		this.updateProgress(0,'Trwa przygotowanie danych');
	}

}); //extend

Ext.reg('progresswindow',mk.ProgressWindow);
