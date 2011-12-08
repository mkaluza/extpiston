# $Revision: 1.9 $
# vim: set fileencoding=utf-8

import re
import types
import pprint as pretty_print
pp = pretty_print.PrettyPrinter(indent=4)
pprint = pp.pprint

from piston.emitters import Emitter
from piston.handler import BaseHandler
from piston.resource import Resource
from piston.utils import rc, require_mime, require_extended, validate, coerce_put_post

#from piston.authentication import DjangoAuthentication

from django.contrib.auth.models import Permission,Group,User
from django.core.exceptions import ObjectDoesNotExist, MultipleObjectsReturned
from django.core.serializers.json import DateTimeAwareJSONEncoder
import django
from django.db.models.query import QuerySet
from django.forms.models import model_to_dict
from django.http import HttpResponse, Http404
from django.shortcuts import render_to_response
from django.template import Context, loader
from django.utils import simplejson
from django.utils.encoding import force_unicode
from django.utils.functional import Promise

import settings

from functions import Timer

def flatten_dict(d, name = None):
	if not isinstance(d,dict):return d
	res=[]
	for k,v in d.iteritems():
		if name:
			newname = "%s__%s" % (name,k)
		else: newname = k
		if isinstance(v,dict):
			res += flatten_dict(v,newname).items()
		else:
			res.append((newname,v))
	return dict(res)

def flatten_fields(fields, prefix = None, model = None, include_fk_pk = False):
	def append(res, field, prefix = None):
		if prefix:
			res.append("%s__%s" % (prefix,field))
		else:
			res.append(field)
		return res

	res=[]

	if include_fk_pk and model: append(res,model._meta.pk.name,prefix)

	for f in fields:
		if isinstance(f,tuple):
			new_prefix = f[0]
			if prefix:
				new_prefix = "%s__%s" % (prefix,new_prefix)
			if model:
				try:
					rel_model = model._meta.get_field_by_name(f[0])[0].rel.to
				except:
					rel_model = None
			else:
				rel_model = None
			res+=flatten_fields(f[1], new_prefix, rel_model, include_fk_pk)
			continue
		append(res,f,prefix)
	return res

def get_field_type(cls, model = None, name = None):
	field_map = {
		'AutoField': 'display',
		'BigIntegerField': 'number',
		'IntegerField': 'number',
		'DateField': 'date',
		'DateTimeField': 'datetime',
		'BooleanField': 'bool',
		'TextField': 'textarea',
		'FileField': 'file',
		'FloatField': 'float',
		'ImageField': 'image',
	}
	return field_map.get(cls,'text')

		#help text
		#TODO As currently implemented, setting auto_now or auto_now_add to True will cause the field to have editable=False and blank=True set.
		#TODO trzeba wymyslic, czy ustawiac flage read only, czy zmieniac na displayfield

def get_model_properties(model):
	result = []
	for p in dir(model):
		try:
			if isinstance(getattr(model,p),property):
				result.append(p)
		except:
			pass
	return result

def flatten_fields2(handler, fields = None, model = None, prefix = '', parent_field = None):
	res = []
	if not model: model = handler.model
	if not fields: fields = handler.fields
	model_fields = dict([(field.name,field) for field in model._meta.fields])
	model_properties = get_model_properties(model)

	for field in fields:
		if isinstance(field, tuple):
			new_prefix = field_name = field[0]
			if prefix: new_prefix = "%s__%s" % (prefix,new_prefix)
			if field_name in model_fields:
				parent_field = model_fields[field_name]
				new_model = parent_field.rel.to		#get model that is referenced by this foreign key

				res += flatten_fields2(handler,fields = field[1], model = new_model, prefix = new_prefix, parent_field = parent_field)
			else:
				for f in flatten_fields(field[1],new_prefix):
					res.append((f, {'name':f, 'header': f, 'type': 'text'}))
			continue

		ff = model_fields.get(field, None)

		if prefix: field = "%s__%s" % (prefix,field)

		field_dict = {'name':field, 'header': field, 'type': 'text'}

		if ff:
			field_dict['type'] = get_field_type(ff.__class__.__name__)
			if type(ff.verbose_name) in [str, unicode]: field_dict['header'] = ff.verbose_name
			elif isinstance(ff.verbose_name, Promise):
				try:
					field_dict['header'] = force_unicode(ff.verbose_name)
				except:
					pass	#TODO warning message or try to fix it?
			if ff.help_text and type(ff.help_text) in [str,unicode]: field_dict['tooltip'] = ff.help_text
			if ff.default != django.db.models.fields.NOT_PROVIDED: field_dict['value']=ff.default
			field_dict['editable']=ff.editable
			#TODO figure this out... can't be this way because if field is invisible and not allowed blank, the store will not save
			#if parent_field:
			#	field_dict['allowBlank'] = parent_field.blank
			#else:
			#	field_dict['allowBlank'] = ff.blank	#can't be this way
			if ff.choices: field_dict['choices'] = ff.choices
			if ff.primary_key:
				field_dict.update({'hidden':True, 'hideable':False})
				if not prefix: field_dict['pk'] = True
				if prefix and '__' not in prefix: 	#this is a foreign key field that model directly owns, so it can be editable
					if type(parent_field.verbose_name) in [str,unicode]: field_dict['header'] = parent_field.verbose_name

					module_name = ".".join(model.__module__.split('.')[1:-1])
					if not module_name: module_name = 'main'
					field_dict['type'] = "%s.%s" % (module_name,model.__name__.lower())
					field_dict['fk'] = True

		if field in handler.m2m_handlers:
			field_dict['m2m'] = True
			m2mhandler = handler.m2m_handlers[field]
			module_name = ".".join(m2mhandler.model.__module__.split('.')[1:-1])
			if not module_name: module_name = 'main'
			field_dict['type'] = "%s.%s" % (module_name,m2mhandler.model.__name__.lower())

		if field in handler._reverse_related_fields:
			field_dict['rev'] = True
			revhandler = handler._reverse_related_fields[field]['handler']
			module_name = ".".join(revhandler.model.__module__.split('.')[1:-1])
			if not module_name: module_name = 'main'
			field_dict['type'] = "%s.%s" % (module_name,revhandler.model.__name__.lower())
			field_dict['actions'] = ['add', 'edit', 'remove']

		res.append((field, field_dict))

	return res

def deepUpdate(dst,src):
	if not src: return dst
	if dst == None: return src
	if isinstance(src,dict): src = src.iteritems()
	for name, data in src:
		if name in dst: dst[name].update(data)
		else: dst[name] = data
	return dst
