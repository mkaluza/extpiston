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
		var index = ed.store.findExact(ed.initialConfig.valueField,value);	//has to be findExact - otherwise it does a string match!! and first, that starts with a searched value matches!! eg. find('id',1) will match 10!!
		var rec = ed.store.getAt(index);
		if (!rec) return '';
		var val = rec.data[ed.initialConfig.displayField];
		return val;
	} catch (e) { return value; }
};


