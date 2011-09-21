{# vim: set fileencoding=utf-8 #}

{% if store_type|default:"json" == 'json' %}
var {{ name }}StoreConfig = {
	url: '/{{app_label}}/api/{{ name|lower }}',
	baseParams: { 
		{% if page_size %}limit:{{ page_size }},start: 0,{% endif %}
	},
	method: 'GET',
	root: 'data',
	storeId: '{{ name }}Store',
	fields: {{ fields }},
	writer: new Ext.data.JsonWriter({encode:true}),
	autoSave: false,
	idProperty: '{{pk}}',
	restful: true
};

{% if not nocreate %}
{# TODO only shared stores shoud have storeId set #}
var {{ name }}Store = new Ext.data.JsonStore({{ name}}StoreConfig);
{% endif %}
{% endif %}

{% if store_type == 'array' %}
var {{ name }}Store = new Ext.data.ArrayStore({
	data: {{ data }},
	storeId: '{{ name }}Store',
	idProperty: '{{pk}}',
	fields: {{ fields }}
});
{% endif %}
