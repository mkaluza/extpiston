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
var {{ name }}Store = {{ data }};
{% endif %}

{% if store_type == 'Xrray' %}
{# to nie dziala i nie wiem dlaczego :/ #}
var {{ name }}Store = new Ext.data.ArrayStore({
	autoLoad: {{ data }},
	{#data: {{ data }},#}
	{#root: 'data',#}
	storeId: '{{ name }}Store',
	idIndex: 0,
	fields: {{ fields }}
});
{% endif %}
