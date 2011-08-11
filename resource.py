# $Revision: 1.9 $
# vim: set fileencoding=utf-8

import re

from piston.resource import Resource
from piston.utils import rc, coerce_put_post

from django.contrib.auth.models import Permission,Group,User
from django.http import HttpResponse, Http404
from django.shortcuts import render_to_response
from django.template import Context, loader
from django.utils import simplejson

import settings

from functions import Timer
from internal import *

class ExtResource(Resource):
	def __init__(self,handler, authentication=None, authorization=None,**kwargs):
		super(ExtResource,self).__init__(handler, authentication=authentication, authorization=authorization)
		try:
			self.fields = flatten_fields(self.handler.fields)
		except:
			self.fields = [f.name for f in self.handler.model._meta.fields]

		#TODO to powinno byc w handlerze
		self.columns = {}
		col_num = 0
		for k,v in flatten_fields2(self.handler):
			self.columns[k]=v
			v['_col_num']=col_num
			col_num += 1

		deepUpdate(self.columns, getattr(self.handler,'columns',None))
		deepUpdate(self.columns, kwargs.pop('columns',None))

		params = { # name, value, if value is a function that returns value, that is its argument
			'value_field': (self.handler.model._meta.pk.name, None),
			'display_field': (lambda x: x.value_field, [self,]),	#self is passed by reference
			'store_type': ('json', None),
			'separate_store': (True, None),
			'page_size': (None,None),
			}

		self.params = params

		for name,(default,args) in self.params.iteritems():
			if args is not None: default = default(*args)	#if arguments are given, default is a function
			#set atribute based on kwargs OR handler config OR default value
			setattr(self, name, kwargs.pop(name,getattr(self.handler,name,default)))
			#if name in kwargs: setattr(self, name, kwargs.pop(name))
			#else:
			#	if hasattr(self.handler,name): setattr(self, name, getattr(self.handler,name))
			#	else:
			#		setattr(self,name,default)
		self.forms = kwargs.pop('forms',{})
		self.name = kwargs.pop('name',getattr(self.handler,'name')).lower()
		self.verbose_name = self.handler.verbose_name

	def __call__(self, request, *args, **kwargs):
		#TODO to dziala tylko, jka jest encode: true w jsonWriter
		coerce_put_post(request)
		if not hasattr(request, 'data') and request.method in ['GET','PUT','POST']:
			data = dict([(k,v) for k,v in getattr(request,request.method).iteritems()])
		else: data = getattr(request,'data',{})

		if 'data' in data:
			#print 'data2:', type(data['data']), data['data']
			if type(data['data']) in [unicode,str]: data['data'] = simplejson.loads(data['data'])
			setattr(request,'data',data['data'])
			del data['data']
		else:
			setattr(request,'data',data)
		setattr(request,'params',data)

		return super(ExtResource, self).__call__(request, *args, **kwargs)

	def determine_emitter(self, request, *args, **kwargs):
		return kwargs.pop('emitter_format', request.GET.get('format', 'ext-json'))

	def urls(self, *args, **kwargs):
		#args are numbers by default
		from django.conf.urls.defaults import url
		urls=[]
		for k in args: urls.append(url(r'%s/%s/(?P<%s>\d+)$' % (self.name,k,k),self))
		for k,v in kwargs.iteritems(): urls.append(url(r'%s/%s/(?P<%s>%s)$' % (self.name,k,k,v),self))
		for f in self.handler.model._meta.many_to_many:
			if not f.name in self.columns: continue
			sub_handler = self.handler.m2m_handlers.get(f.name,ManyToManyHandler(field=f))
			sub_resource = ExtResource(sub_handler)
			urls.append(url(r'^%(name)s/(?P<main_id>\d+)/%(m2m_name)s$' % {'name':self.name,'m2m_name':f.name},sub_resource))
			urls.append(url(r'^%(name)s/(?P<main_id>\d+)/%(m2m_name)s/(?P<id>\d+)$' % {'name':self.name,'m2m_name':f.name},sub_resource))

		return urls+[
				url(r'^%s/(?P<id>\d+)$' % self.name, self),
				url(r'^%s$' % self.name, self),
				url(r'^%s/js/(?P<name>\w+(.js)?)?/?(?P<name2>\w+(.js)?)?/?$' % self.name, self.render_js),
				]

	def render_form(self, request, name = '', dictionary = None):
		columns = {}
		if name and name not in ['default','all']:
			if name not in self.forms: raise Http404
			_columns = [(n,self.columns[n]) for n in self.forms[name]]
		else:
			_columns = self.columns.iteritems()

		for k,col in _columns:
			#print k,col
			if "__" in col['name'] and not col.get('fk',None): continue
			newcol = {'fieldLabel': col['header'], 'name': col['name'], '_col_num':col['_col_num']}
			if 'width' in col: newcol['width'] = col['width']
			if 'height' in col: newcol['height'] = col['height']
			if 'format' in col: newcol['format'] = col['format']
			if col.get('pk',None):
				newcol.update({'xtype': 'displayfield', 'hidden': True})
			elif 'fk' in col and col['fk']:
				newcol['xtype'] = col['type']+'.combo'
			elif col.get('choices',None):
				newcol.update({'xtype': 'combo', 'store': col['choices'], 'triggerAction': 'all', 'emptyText':'Wybież...', 'forceSelection': True, 'name': col['name'], 'hiddenName': col['name']})
			elif col['type'] == 'bool':
				newcol['xtype'] = 'checkbox'
			elif col['type'] == 'textarea':
				newcol['xtype'] = 'textarea'
			elif col['type'] == 'date':
				newcol['xtype'] = 'datefield'
				if hasattr(settings,'DATE_FORMAT') and not 'format' in newcol: newcol['format'] = settings.DATE_FORMAT
			elif col['type'] in [ 'file', 'image' ]:
				newcol['xtype'] = 'fileuploadfield'
			elif col['type'] == 'datetime':
				newcol['xtype'] = 'datefield'
				if hasattr(settings,'DATETIME_FORMAT') and not 'format' in newcol: newcol['format'] = settings.DATETIME_FORMAT
			else:
				newcol['xtype'] = col['type']+'field'
			columns[k]=newcol

		sorted_column_names = [col[0] for col in sorted(columns.iteritems(),key=lambda x: x[1]['_col_num']) ]

		return {'formFields':  simplejson.dumps(columns,sort_keys = False, indent = 3), 'formFieldNames':simplejson.dumps(sorted_column_names, indent = 3)}


	def render_grid(self, request, name = '', dictionary = None):
		columns = {}
		for k,col in self.columns.iteritems():
			col['dataIndex'] = col['name']
			columns[k]=col

		sorted_column_names = [col[0] for col in sorted(columns.iteritems(),key=lambda x: x[1]['_col_num']) ]

		return {'gridColumns': simplejson.dumps(columns, indent = 3), 'gridColumnNames':simplejson.dumps(sorted_column_names, indent = 3)}

	def render_js(self, request, name, name2 = '', dictionary=None):
		"""
		JS can be rendered by calling api/$name/js/X, where X is a file name with or without .js extension.
		calling with no X assumes x=all
		"""
		name = (name or 'all').lower().replace('.js','') #normal default value doesn't work with (P..)? since django then passes None as a value
		name2 = (name2 or '').lower().replace('.js','')
		#print 'render', name
		if name not in ['form','store','grid','combo','all']:
			raise Http404

		app_label = re.sub('\.?api.handlers','',self.handler.__module__) or 'main'

		if name2 in ['default','all']: name2 = ''
		defaults = {'fields': self.fields, 'verbose_name': self.verbose_name,'name':self.name, 'name2': name2, 'app_label':app_label, 'settings': settings, 'pk': self.handler.pk_name}
		defaults.update(dict([(f, getattr(self,f)) for f in self.params.keys()]))

		if self.store_type == 'array' and name != 'grid':
			resp = self(request,emitter_format='array-json')
			defaults['data'] = resp.content

		#if name == 'grid': defaults.update(self.render_grid(request))
		#elif name == 'form': defaults.update(self.render_form(request))
		#else: defaults['columns'] = simplejson.dumps([self.columns[k] for k in set(self.fields) & set(self.columns.keys())],sort_keys = settings.DEBUG,indent = 3 if settings.DEBUG else None)

		defaults.update(self.render_grid(request))
		defaults.update(self.render_form(request))
		defaults['columns'] = simplejson.dumps([self.columns[k] for k in set(self.fields) & set(self.columns.keys())],indent = 3)
		defaults.update(dictionary or {})

		body = loader.get_template('mksoftware/%s.js.tpl'%name).render(Context(defaults,autoescape=False))
		body = re.sub("(?m)^[ \t]*\n",'',body) #remove whitespace in empty lines
		if not settings.DEBUG: body = re.sub("\t+\/\/.*",'',body) # remove comments
		return HttpResponse(body,mimetype='text/javascript')

