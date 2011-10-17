{# vim: set fileencoding=utf-8 #}

Ext.namespace('{{app_label|title}}.{{name}}');

{{app_label|title}}.{{name}}.JsonStore = Ext.extend(ExtPiston.data.JsonStore, {
	constructor: function(config) {
		var config = config || {};
		var cfg = {{ json_config }};
		Ext.applyIf(config,cfg);
		{{app_label|title}}.{{name}}.JsonStore.superclass.constructor.call(this, config);
	}//constructor
});

{% if not nocreate %}
{# TODO only shared stores shoud have storeId set #}
//var {{ name }}Store = new Ext.data.JsonStore({{ name}}StoreConfig);
{% endif %}

{{app_label|title}}.{{name}}.ArrayStore = Ext.extend(Ext.data.ArrayStore, {
	constructor: function(config) {
		var config = config || {};
		var cfg = {{ array_config }};
		Ext.applyIf(config,cfg);
		{{app_label|title}}.{{name}}.ArrayStore.superclass.constructor.call(this, config);
	}//constructor
});

{% if store_type|default:"json" == 'json' %}
{{app_label|title}}.{{name}}.Store = {{app_label|title}}.{{name}}.JsonStore;
{% else %}
{{app_label|title}}.{{name}}.Store = {{app_label|title}}.{{name}}.ArrayStore;
{% endif %}

{{app_label|title}}.{{name}}.GlobalStoreName = "{{ name }}Store";
