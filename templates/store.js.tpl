{# vim: set fileencoding=utf-8 #}

{{ name }}Store=new Ext.data.JsonStore({
	url: 'api/{{ name }}',
	{% if pageSize %}autoLoad: {params: {start: 0, limit:{{ pageSize }} }}, {% endif %}
	method: 'GET',
	root: 'data',
	storeId: '{{ name }}Store',
	fields: {{ fields }},
	restful: true,
	totalProperty: 'totalCount',
});

