# $Revision: 1.9 $
# vim: set fileencoding=utf-8

import re

from piston.handler import typemapper
from piston.resource import Resource
from piston.utils import rc, coerce_put_post

from django.conf.urls.defaults import url
from django.contrib.auth.models import Permission,Group,User
from django.http import HttpResponse, Http404
from django.shortcuts import render_to_response
from django.template import Context, loader
from django.utils import simplejson

import settings

from functions import Timer, request_debug
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
		self.base_url = self.name

		#for related relations
		self.parent = kwargs.pop('parent', None)
		if self.parent:
			self.base_url = r"%s/(?P<%s>\d+)/%s" % (self.parent.base_url, self.handler.parent_fk_name, self.base_url)
			#TODO a co, jesli handler nie ma parenta?

		#handle related fields and handlers
		self.reverse_related_fields = {}
		for f in self.handler.reverse_related_fields:
			#if not f in self.columns: continue
			if type(f) == tuple:
				#some params are given
				f_name = f[0]

				if type(f[1])==dict:
					#more params are given
					params = f[1]
				else:
					#only a handler is given
					params = {'handler': f[1]}

				if isinstance(params['handler'],(str,unicode)):
					#just a handler class name is given, so we have to find a class
					params['handler'] = filter(lambda handler: handler.__name__ == params['handler'], typemapper)[0]
			else:
				#only a field name is given, search for a handler for the related model
				f_name = f
				f = self.handler.model._meta.get_field_by_name(f_name)[0]
				sub_handler = filter(lambda handler: typemapper[handler][0] == f.model, typemapper)[0]	#get default handler for model - has to be defined
				#TODO handle handlers as strings (just a class_name)
				#TODO if no handler is defined, create a read-only handler with pk and __str__ only
				params = {'handler': sub_handler}

			self.reverse_related_fields[f_name] = params

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

		data.update(getattr(request,'params',{}))	#if any inherited handler already set any params, keep them
		setattr(request,'params',data)

		response = super(ExtResource, self).__call__(request, *args, **kwargs)
		#if it's a file upload, it's not XHR, it's via a hidden iframe and so response type must be text/html, otherwise browser shows 'save as' dialog for file 'application/json'
		if len(request.FILES): response['content-type']=response['content-type'].replace('application/json','text/html')	#TODO swap any mime for this with re
		return response

	def determine_emitter(self, request, *args, **kwargs):
		return kwargs.pop('emitter_format', request.GET.get('format', 'ext-json'))

	def urls(self, *args, **kwargs):
		#args are numbers by default
		urls=[]
		#TODO zrobić z tego jakieś RPC
		for k in args: urls.append(url(r'%s/%s/(?P<%s>\d+)$' % (self.name,k,k),self))
		for k,v in kwargs.iteritems(): urls.append(url(r'%s/%s/(?P<%s>%s)$' % (self.name,k,k,v),self))

		#standard piston urls
		_urls = ['', r'(?P<id>\d+)']
		urls += [url(r"^%s/*%s$" % (self.base_url,u),self) for u in _urls]

		if self.parent: return urls		#if this is a related resource, generate only standard urls

		urls.append(url(r'^%s/js/(?P<name>\w+(.js)?)?/?(?P<name2>\w+(.js)?)?/?$' % self.base_url, self.render_js))	#js generator

		#TODO przenieść część do __init__ oraz zrobić odwołanie do urls(), a nie generować palcem
		for f in self.handler.model._meta.many_to_many:
			if not f.name in self.columns: continue
			sub_handler = self.handler.m2m_handlers.get(f.name,ManyToManyHandler(field=f))
			sub_resource = ExtResource(sub_handler)
			urls.append(url(r'^%(name)s/(?P<main_id>\d+)/%(m2m_name)s$' % {'name':self.name,'m2m_name':f.name},sub_resource))
			urls.append(url(r'^%(name)s/(?P<main_id>\d+)/%(m2m_name)s/(?P<id>\d+)$' % {'name':self.name,'m2m_name':f.name},sub_resource))

		#handle related fields and handlers
		for f, params in self.reverse_related_fields.iteritems():
			sub_resource = RelatedExtResource(params['handler'], parent = self)
			urls += sub_resource.urls()

		#rpc urls
		for name in self.handler.rpc:
			#handler procedures
			proc = getattr(self.handler,name,None)
			if proc and callable(proc):
				urls.append(url(r'%s/%s' % (self.base_url,name),proc))
				continue

			#model procedures
			proc = getattr(self.handler.model,name,None)
			if proc and callable(proc):
				urls.append(url(r'%s/(?P<id>\d+)/%s' % (self.base_url,name),self.handler.exec_rpc_on_model,{'procname':name}))
				continue

		return urls

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

class RelatedExtResource(ExtResource):
	def __call__(self, request, *args, **kwargs):
		params = getattr(request,'params',{})
		params[self.handler.parent_fk_name] = kwargs.pop(self.handler.parent_fk_name)
		setattr(request,'params',params)
		return super(RelatedExtResource, self).__call__(request, *args, **kwargs)