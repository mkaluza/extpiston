{# vim: set fileencoding=utf-8 #}

{% if store_type|default:"json" == 'json' %}
var {{ name }}Store = new Ext.data.JsonStore({
	url: '{{app_label}}/api/{{ name|lower }}',
	autoLoad: {% if page_size %}{params: {start: 0, limit:{{ page_size }} }} {% else %} true {% endif %},
	method: 'GET',
	root: 'data',
	storeId: '{{ name }}Store',
	fields: {{ fields }},
	restful: true,
});
{% endif %}

{% if store_type == 'array' %}
var {{ name }}Store = new Ext.data.ArrayStore({
	data: {{ data }},
	storeId: '{{ name }}Store',
	fields: {{ fields }}
});
{% endif %}
