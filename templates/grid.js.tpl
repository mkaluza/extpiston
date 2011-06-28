{# vim: set fileencoding=utf-8 #}

var {{ name }}Grid = {
	xtype: 'grid',
	autoScroll: false,
	autoHeight: true,
	columns: {{ name }}Columns,
	store: {{ name }}Store,
	loadMask: true,
	{% if pageSize %}
	bbar: {
		xtype:'paging',
		pageSize: {{ pageSize }},
		store: {{ name }}Store,
		displayInfo: true,
		displayMsg: 'Wyniki {0} - {1} z {2}',
		emptyMsg: "Brak wyników"
	},
	{% endif %}
	viewConfig: {
		autoFill: true
	}
};

var {{ name }}Tab = {
	title: '{{ title }}',
	layout: 'fit',
	items: [{{ name }}Grid]
}
