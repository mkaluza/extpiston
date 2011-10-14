{# vim: set fileencoding=utf-8 #}

Ext.namespace('{{app_label|title}}.{{name}}');

{% if store_type|default:"json" == 'json' %}
{{app_label|title}}.{{name}}.Store = Ext.extend(ExtPiston.data.JsonStore,
{{ config }}
);

{% if not nocreate %}
{# TODO only shared stores shoud have storeId set #}
//var {{ name }}Store = new Ext.data.JsonStore({{ name}}StoreConfig);
{% endif %}
{% endif %}

{% if store_type == 'array' %}
{{app_label|title}}.{{name}}.Store = Ext.extend(Ext.data.ArrayStore,
{{ config }}
);
{% endif %}
