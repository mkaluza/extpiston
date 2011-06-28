Ext.ns('mk');

mk.IFrameWindow = Ext.extend(Ext.Window, {
	initComponent: function() {
		var config = {
			width: 800,
			height: 600,
//			padding: 5,
//			border: false,
//			modal: false,
//			resizeable: true,
//			closable: true,
			buttons: [{text:'Close',handler: function() { this.hide();},scope:this}],
			buttonAlign: 'center'

		};
		this.iframe = Ext.DomHelper.append(document.body, {tag: 'iframe', frameBorder: 0, width: '100%', height: '100%'}); 
		this.appended = false;
		//this.iframe = Ext.DomHelper.append(document.body, {tag: 'iframe', id: 'frame-' + winId, frameBorder: 0, width: '100%', height: '100%'}); 

		Ext.apply(this, Ext.apply(this.initialConfig, config));

		mk.IFrameWindow.superclass.initComponent.apply(this, arguments);
	},//initComponent
	updateHtml: function(html) {
		this.iframe.contentWindow.document.body.innerHTML=html;
		//mk.IFrameWindow.superclass.update.apply(this);
		//this.doLayout(false,true);
	},
	show: function(html){
		mk.IFrameWindow.superclass.show.apply(this);
		//this.doLayout();
		if (!this.appended) {
			this.body.appendChild(this.iframe);
			this.appended=true;
		}
		//this.doLayout();
		if (html) this.updateHtml(html);
		//this.doLayout();
	}


}); //extend

Ext.reg('iframewindow',mk.IFrameWindow);
