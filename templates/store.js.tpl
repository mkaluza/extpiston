{# vim: set fileencoding=utf-8 #}

var {{ name }}Store = new Ext.data.JsonStore({
	url: 'api/{{ name }}',
	autoLoad: {% if pageSize %}{params: {start: 0, limit:{{ pageSize }} }} {% else %} true {% endif %},
	method: 'GET',
	root: 'data',
	storeId: '{{ name }}Store',
	fields: {{ fields }},
	restful: true,
});
