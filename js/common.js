function fkrenderer(value, metaData, record, rowIndex, colIndex, store) {
	/*
	// tego bedziemy mogli uzyc kiedy indziej
	var parts = this.dataIndex.split('__');
	parts.pop();
	var fk_name = parts.join('__');
	*/
	try {
		var ed = this.editor;
		if (ed.store.totalLength===undefined) ed.store.load();	//TODO wrzucic reszte w funkcje i jako callback
		var index = ed.store.find(ed.initialConfig.valueField,value);
		var rec = ed.store.getAt(index);
		var val = rec.data[ed.initialConfig.displayField];
		return val;
	} catch (e) { return value; }
};


