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
	"""ExtResource Class

	description
	"""
	def __init__(self,handler, authentication=None, authorization=None,**kwargs):
		"""
		Initialize a resource
		"""

		super(ExtResource,self).__init__(handler, authentication=authentication)
		try:
			self.fields = flatten_fields(self.handler.fields)
		except:
			self.fields = [f.name for f in self.handler.model._meta.fields]
		"""Initialize fields based on either handler's fields or handlers model fields"""

		self.name = getattr(self, 'name', kwargs.pop('name', getattr(self.handler, 'name')).lower())
		"""Resource name, if not set, is taken from: kwargs, handler.name"""

		self.verbose_name = getattr(self, 'verbose_name', self.handler.verbose_name)
		"""Resource verbose name, if not set, is taken from the handler"""

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
			'value_field': (self.handler.pkfield, None),
			'display_field': (lambda x: x.value_field, [self,]),	#self is passed by reference
			'store_type': ('json', None),
			'separate_store': (True, None),
			'page_size': (None,None),
			}
		"""Default values for resource object fields. These names are later used in render_js to get defaults for component rendering functions"""

		self.params = params

		for name,(default,args) in self.params.iteritems():
			if args is not None: default = default(*args)	#if arguments are given, default is a function
			#set atribute based on kwargs OR handler config OR default value
			setattr(self, name, kwargs.pop(name,getattr(self.handler,name,default)))

		self.forms = getattr(self,'forms', { 'default': {}})
		self.grids = getattr(self,'grids', { 'default': {}})
		deepUpdate(self.forms, kwargs.pop('forms',None))
		deepUpdate(self.grids, kwargs.pop('grids',None))

		#to shorten arguments, default grid/form can be given as grid/form
		deepUpdate(self.forms['default'], kwargs.pop('form',None))
		deepUpdate(self.grids['default'], kwargs.pop('grid',None))
		"""default grid and form definition can be provided with grid and form fields set in a resource subclass"""

		self.base_url = self.name
		"""Default base_url is self.name"""

		self.parent = None

		#TODO to powinno byc w handlerze
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
		"""Main request handler

		**File uploads**

		File uploads from ExtJS forms (with fileUpload: true) are not XHR - they are always POST and multipart/form-data.
		If such a request is detected, response type is changed from application/javasctript to text/html.
		If a pk is given in kwargs, it means that the request is an update and ``request.method`` is changed to PUT.

		**Request data preprocessing**

		Data from a request can be either directly in ``QueryDict`` (TODO forms only?) or as ``QueryDict.data`` (grids). Guess what it is and clean it up.
		If ``QueryDict.data`` exists, it is used for ``request.data`` and the rest of the ``QueryDict`` is ``request.params``, otherwise both ``request.data`` and ``request.params`` are set to ``QueryDict``.

		**IMPORTANT**

		Forms cannot contain fields named ``data`` (yet) because it'll confuse the code above and result in strange behavior.

		"""

		#TODO to dziala tylko, jka jest encode: true w jsonWriter
		coerce_put_post(request)
		if request.method=='POST' and request.META['CONTENT_TYPE'].startswith('multipart/form-data'):
			#it's probably a submit from a form with fileUpload
			if self.handler.pkfield in kwargs:
				#it's an update, so make it a PUT
				setattr(request,'PUT',request.POST)
				request.method = 'PUT'
			extjs_file_post = True
		else:
			extjs_file_post = False

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
		if extjs_file_post: response['content-type']=response['content-type'].replace('application/json','text/html')	#TODO swap any mime for this with re
		return response

	def determine_emitter(self, request, *args, **kwargs):
		return kwargs.pop('emitter_format', request.GET.get('format', 'ext-json'))

	def urls(self, *args, **kwargs):
		"""Generates all urls handled by this resource

		This includes:

		- Two standard piston urls: name/$ for all GET/POST, and name/(?P<id>\d+)$ to GET/PUT/DELETE a specific record.

		  Subresources (those that have parents) don't generate any urls except the default ones.
		  *Primary* resources additionally generate urls for getting js components, related fields and rpc methods for handler and model.
		"""

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
		for f, sub_handler in self.handler.m2m_handlers.iteritems():
			if not f in self.columns: continue
			sub_resource = ExtResource(sub_handler)
			urls.append(url(r'^%(name)s/(?P<main_id>\d+)/%(m2m_name)s$' % {'name':self.name,'m2m_name':f},sub_resource))
			urls.append(url(r'^%(name)s/(?P<main_id>\d+)/%(m2m_name)s/(?P<id>\d+)$' % {'name':self.name,'m2m_name':f},sub_resource))

		#handle related fields
		for f, params in self.reverse_related_fields.iteritems():
			sub_resource = RelatedExtResource(params['handler'], parent = self, field = f)
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

	def render_form(self, request, name = 'default', dictionary = None):
		columns = {}
		_columns = self.columns.iteritems()
		if name:	#if a form name is given
			if name not in self.forms: raise Http404	#check if it is defined
			if self.forms[name]:	#if anything is set there
				_columns = [(n,self.columns[n]) for n in self.forms[name].keys() if not n.startswith('_')]	#add only columns mentioned
				#_keywords are internal
				#to add columns with default values, add 'name':{}

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
			elif  col.get('m2m',False):
				newcol['xtype'] = col['type']+'.m2m'
			elif col.get('choices',None):
				newcol.update({'xtype': 'combo', 'store': col['choices'], 'triggerAction': 'all', 'emptyText':'Wybież...', 'forceSelection': True, 'name': col['name'], 'hiddenName': col['name']})
			elif col['type'] == 'bool':
				newcol['xtype'] = 'checkbox'
			elif col['type'] == 'textarea':
				newcol['xtype'] = 'textarea'
			elif col['type'] == 'date':
				newcol['xtype'] = 'datefield'
				if hasattr(settings,'DATE_FORMAT') and not 'format' in newcol: newcol['format'] = settings.DATE_FORMAT
			elif col['type'] == 'datetime':
				newcol['xtype'] = 'datefield'
				if hasattr(settings,'DATETIME_FORMAT') and not 'format' in newcol: newcol['format'] = settings.DATETIME_FORMAT
			elif col['type'] in [ 'file', 'image' ]:
				newcol['xtype'] = 'fileuploadfield'
			else:
				newcol['xtype'] = col['type']+'field'

			newcol.update(self.forms[name].get(k,{}))	#update generated column/field definition with value passwd to a Resource via form/forms parameter
			columns[k]=newcol

		sorted_column_names = [col[0] for col in sorted(columns.iteritems(),key=lambda x: x[1]['_col_num']) ]

		return {'formFields':  simplejson.dumps(columns,sort_keys = False, indent = 3), 'formFieldNames':simplejson.dumps(sorted_column_names, indent = 3)}

	def render_grid(self, request, name = 'default', dictionary = None):
		columns = {}
		_columns = self.columns.iteritems()
		if name:	#if a form name is given
			if name not in self.grids: raise Http404	#check if it is defined
			if self.grids[name]:	#if anything is set there
				_columns = []
				for n,v in self.grids[name].iteritems():		#add only columns mentioned
					if n.startswith('_'): continue		#_keywords are internal
					col = (n,self.columns[n].copy())
					col[1].update(v)
					_columns.append(col)

				#to add columns with default values, add 'name':{}

		for k,col in _columns:
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
		defaults = {'fields': self.fields, 'verbose_name': self.verbose_name,'name':self.name, 'name2': name2, 'app_label':app_label, 'settings': settings, 'pk': self.handler.pkfield}
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

	def error_handler(self,*args,**kwargs):
		raise

class RelatedExtResource(ExtResource):
	def __init__(self, handler, parent = None, field = None, *args,  **kwargs):
		super(RelatedExtResource,self).__init__(handler, *args,**kwargs)

		self.parent = parent
		"""If resource is a subresource (for reverse relations), parent is given in kwargs and base_url is prefixed with parent's base_url and a parent pk parameter, which name is self.handler.parent_fk_name"""

		if hasattr(self.handler,'parent_fk_name'):
			#explicit parent fk name indicates that we'll be handling the relation manually - remove it from kwargs
			self.parent_fk_name = self.handler.parent_fk_name
			self.auto_parent_fk = False
		else:
			#otherwise handle it automatically
			self.parent_fk = self.parent.handler.model._meta.get_field_by_name(field)[0].field
			self.auto_parent_fk = True

		self.base_url = r"%s/(?P<%s>\d+)/%s" % (self.parent.base_url, 'parent_id', self.base_url)
		#TODO a co, jesli handler nie ma parenta?

	def __call__(self, request, *args, **kwargs):
		params = getattr(request,'params',{})
		if self.auto_parent_fk:
			#for GET/query, we can't give attname (parent_name_id), but we can give parent id naming it with field name
			if request.method == 'GET': parent_fk_name = self.parent_fk.name
			#for the rest, we either can give parent pk as parent_field_id, or parent instance as parent_field
			else: parent_fk_name = self.parent_fk.attname
			params[parent_fk_name] = kwargs.pop('parent_id')
			kwargs[parent_fk_name] = params[parent_fk_name]
		else:
			#handler takes care about parent-child relation
			params[self.parent_fk_name] = kwargs.pop('parent_id')

		setattr(request,'params',params)
		return super(RelatedExtResource, self).__call__(request, *args, **kwargs)
