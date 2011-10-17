{# vim: set fileencoding=utf-8 #}

Ext.namespace('{{app_label|title}}.{{name}}');

{{app_label|title}}.{{name}}.JsonStore = Ext.extend(ExtPiston.data.JsonStore, {
	constructor: function(config) {
		var config = config || {};
		var cfg = {{ json_config }};

		if (config.fields) {
			var fields = new Ext.util.MixedCollection();
			fields.addAll(cfg.fields);

			//we can only give names, and type and other options will be applied from default config
			for (var i in config.fields) {
				var f = config.fields[i];
				if (typeof(f) == 'string') {
					var ff = fields.find(function(item) {return item.name==f;});
					if (ff) {
						config.fields[i] = ff;
					}
				}  else if (f.name && typeof(f) == 'object') {
					var ff = fields.find(function(item) {return item.name==f.name;});
					if (ff) {
						Ext.applyIf(config.fields[i], ff);
					}
				}
			}
		}
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
