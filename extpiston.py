# $Revision: 1.9 $
# vim: set fileencoding=utf-8

import re
import types

from piston.emitters import Emitter
from piston.handler import BaseHandler
from piston.resource import Resource
from piston.utils import rc, require_mime, require_extended, validate, coerce_put_post

#from piston.authentication import DjangoAuthentication

from django.contrib.auth.models import Permission,Group,User
from django.core.exceptions import ObjectDoesNotExist, MultipleObjectsReturned
from django.core.serializers.json import DateTimeAwareJSONEncoder
from django.db.models.query import QuerySet
from django.forms.models import model_to_dict
from django.http import HttpResponse, Http404
from django.shortcuts import render_to_response
from django.template import Context, loader
from django.utils import simplejson

import settings

class DjangoAuthorization():
	"""
	sposoby definiowania:
	- dla wszystkich (domyslnie), 
	- dla okreslonej metody('create','read', 'update','delete'),
	- do modyfikacji (write='create','update','delete')
	
	if some method is specified, others are implicitly disabled. To enable them, use:
	DjangoAuthorization(read=True,write='is_staff')	#allow reading to everyone (can be connected with authentication), writing for staff only

	łączenie warunków
	- list - OR
	- tuple - AND
	- dict - domyślnie OR, chyba że ma logic:and

	predykaty:
	- funkcja - dostaje request, zwraca bool
	- user(s) - request.user musi w tym byc
	- group(s) - user musi byc w grupie
	- perm(s) - musi miec permsa
	- key-value - dany parametr usera musi miec taka wartosc
	DjangoAuthorization(username='bartur')
	- key - a flag, which must evaluate to True. Can be inverted with '!' in the beginning
	DjangoAuthorization('is_staff')
	DjangoAuthorization('!is_staff')

	examples:

	"""

	def __init__(self,*args,**kwargs):
		allowed_method_names = set(['create','read','update','delete','write'])
		self.method_authz={}

		#filter garbage kwargs
		method_names = allowed_method_names & set(kwargs.keys())

		for m in method_names:
			self.method_authz[m]=kwargs.pop(m)
		args=list(args)
		args.append(kwargs)
		print args
		self.method_authz['all'] = args

	def parse(self,request,el):
		print "parse:",el
		u=model_to_dict(request.user)
		if isinstance(el,types.FunctionType) or isinstance(el,types.LambdaType):
			return el(request)
		elif isinstance(el,dict):
			print "dict"
			if el.has_key('LOGIC') and el['LOGIC'].upper()=='AND':	#default logic is OR
				#AND
				for k,v in el.iteritems(): 
					if k in ['group','user','perm']:
						#TODO zamienic string na obiekt przy pomocy generic relatio
						if not self.parse(request,v): return False
					else:
						if u[k] != v: return False
				return True
			else:
				#OR
				for k,v in el.iteritems(): 
					if k in ['group','user','perm']:
						if self.parse(request,v): return True
					else:
						if u[k] == v: return True
				return False
		elif isinstance(el,list):
			for e in el:
				if self.parse(request,e): return True
			return False	#OR
		elif isinstance(el,tuple):
			for e in el:
				if not self.parse(request,e): return False
			return True	#AND
		elif isinstance(el,User):
			return request.user==el
		elif isinstance(el,Group):
			return el in request.user.groups.all()
		elif isinstance(el,Permission):
			return request.user.has_perm(el)
		elif isinstance(el,bool):
			return el
		else:
			invert=False
			el=str(el)	#TODO potrzebne tutaj?
			if el[0]=='!':	# invert flag
				el=el[1:]
				invert=True
			print 'flag',str(el), u.has_key(str(el)), invert
			print u
			return u.has_key(str(el)) and (invert ^ bool(u[str(el)])) # invert XOR element value

	def authorize(self,request,method):
		res=False
		if self.method_authz.has_key(method):
			res=self.parse(request,self.method_authz[method])
		else:
			if method in ['create','update','delete'] and self.method_authz.has_key('write'):
				res=self.parse(request,self.method_authz['write'])
			else:
				res=self.parse(request,self.method_authz['all'])
		return res
		
	def __call__(self,*args,**kwargs):
		return self.authorize(*args,**kwargs)

class ExtHandler(BaseHandler):
	#exclude = ()
	def __init__(self):
		super(ExtHandler,self).__init__()
		if not hasattr(self,'name'): self.name = self.model._meta.object_name
		if not hasattr(self,'verbose_name'): self.verbose_name = self.model._meta.verbose_name

	def fix_data(self,request):
		if hasattr(request,'data_fixed'): return request
		req_data=getattr(request,request.method)
		if req_data.has_key('data'):
			request.data = simplejson.loads(req_data.get('data'))
		else:
			if len(request.data)==1 and request.data.has_key('data'):
				request.data=request.data['data']
		setattr(request,'data_fixed',True)
		print "request.data.fixed:", request.data
		return request

	def create(self, request, *args, **kwargs):
		#request = self.fix_data(request)
		print "create"
		if not self.has_model():
			return rc.NOT_IMPLEMENTED

		attrs = self.flatten_dict(request.data)

		try:
			pkfield = self.model._meta.pk.name
			#if pkfield in attrs: 
			#niepotrzebne - jak nie ma, to sie wywali, jak jest i nie znajdzie, to tez sie wywali, a jak znajdzie, to powie ze juz istnieje
			inst = self.queryset(request).get(pk=attrs[pkfield])
			return rc.DUPLICATE_ENTRY
		except (self.model.DoesNotExist, KeyError):
			modelfields=set(self.model._meta.get_all_field_names())
			fields=set(attrs.keys())
			modeldata = {}
			#Only model fields
			for f in fields & modelfields: modeldata[f] = attrs[f]

			inst = self.model(**modeldata)
			#the rest (properties)
			for f in fields - modelfields:
				if hasattr(inst,f): setattr(inst,f,attrs[f])
			#TODO fails for inherited models?
			#TODO handle foreign keys?
			inst.save()
			return inst
		except self.model.MultipleObjectsReturned:
			return rc.DUPLICATE_ENTRY

	def update(self, request, *args, **kwargs):
		#request = self.fix_data(request)
		super(ExtHandler, self).update(request,  *args, **kwargs)
		return self.read(request,*args, **kwargs)

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

def flatten_fields(fields, prefix = None):
	res=[]
	for f in fields:
		if isinstance(f,tuple):
			new_prefix = f[0]
			if prefix:
				new_prefix = "%s__%s" % (prefix,new_prefix)
			res+=flatten_fields(f[1], new_prefix)
			continue
		if prefix:
			res.append("%s__%s" % (prefix,f))
		else:
			res.append(f)
	return res

def get_field_type(cls, model = None, name = None):
	field_map = {
		'AutoField': 'display',
		'BigIntegerField': 'number',
		'IntegerField': 'number',
		'DateField': 'date',
		'DateTimeField': 'date',
	}
	return field_map.get(cls,'text')

		#help text
		#TODO As currently implemented, setting auto_now or auto_now_add to True will cause the field to have editable=False and blank=True set.
		#TODO trzeba wymyslic, czy ustawiac flage read only, czy zmieniac na displayfield

def get_model_properties(model):
	result = []
	for p in dir(model):
		if isinstance(getattr(model,p),property):
			result.append(p)
	return result

def flatten_fields2(handler, fields = None, model = None, prefix = None, parent_field = None):
	print "\n1:",fields, model, prefix
	res = {}
	if not model: model = handler.model
	if not fields: fields = handler.fields
	model_fields = dict([(field.name,field) for field in model._meta.fields])
	model_properties = get_model_properties(model)

	print "2:",model.__name__,model_fields.keys()[:10]

	for field in fields:
		print "\t field:", field
		if isinstance(field, tuple):
			new_prefix = field_name = field[0]
			if prefix: new_prefix = "%s__%s" % (prefix,new_prefix)
			if field_name in model_fields:
				parent_field = model_fields[field_name]
				new_model = parent_field.rel.to		#get model that is referenced by this foreign key
				print '3:related',field_name,model_fields[field_name],model_fields[field_name].related.model

				res.update(flatten_fields2(handler,fields = field[1], model = new_model, prefix = new_prefix, parent_field = parent_field))
			else:
				for f in flatten_fields(field[1],new_prefix):
					res[f] = {'name':f, 'header': f, 'type': 'text'}
			continue

		if field in model_fields: ff = model_fields[field]
		else: ff = None

		if prefix: field = "%s__%s" % (prefix,field)

		field_dict = {'name':field, 'header': field, 'type': 'text'}

		if ff:
			field_dict['type'] = get_field_type(ff.__class__.__name__)
			if type(ff.verbose_name) in [str,unicode]: field_dict['header'] = ff.verbose_name
			if ff.help_text and type(ff.help_text) in [str,unicode]: field_dict['tooltip'] = ff.help_text
			if ff.choices: field_dict['choices'] = ff.choices
			if ff.primary_key:
				field_dict.update({'hidden':True, 'hideable':False})
				print "4:",prefix,".".join(model.__module__.split('.')[1:-1]).lower()
				if not prefix: field_dict['pk'] = True
				if prefix and '__' not in prefix: 	#jeden stopien nizej
					if type(parent_field.verbose_name) in [str,unicode]: field_dict['header'] = parent_field.verbose_name
					field_dict['type'] = "%s.%s" % (".".join(model.__module__.split('.')[1:-1]) or 'main',model.__name__.lower())
					field_dict['fk'] = True

		res[field]=field_dict

	return res

class ExtJSONEmitter(Emitter):
	"""
	JSON emitter, understands timestamps, wraps result set in object literal
	for Ext JS compatibility
	"""
	def render(self, request):
		#print request
		cb = request.GET.get('callback')
		#TODO zrobic tak, zeby tu byl queryset a nie lista
		data=self.construct()
		print 'RENDER'
		print type(data)

		if isinstance(data,(list,tuple)):
			data = [flatten_dict(d) for d in data]
		else:
			data = flatten_dict(data)
		ext_dict = {'success': True, 'data': data}
		if hasattr(self.handler,'message'): ext_dict['message']=self.handler.message
		if self.total != None: ext_dict['total'] = self.total
		seria = simplejson.dumps(ext_dict, cls=DateTimeAwareJSONEncoder, ensure_ascii=False, indent=4, sort_keys = settings.DEBUG)

		# Callback
		if cb:
			return '%s(%s)' % (cb, seria)

		return seria
	
Emitter.register('ext-json', ExtJSONEmitter, 'application/json; charset=utf-8')

class ArrayJSONEmitter(Emitter):
	"""
	JSON emitter, understands timestamps, wraps result set in object literal
	for Ext JS compatibility
	"""
	def render(self, request):
		#print request
		cb = request.GET.get('callback')
		#TODO zrobic tak, zeby tu byl queryset a nie lista
		data=self.construct()

		if isinstance(data,(list,tuple)):
			data2 = [ flatten_dict(el) for el in data]
			fields = flatten_fields(self.handler.fields)
			data = [[ el.get(fname,"") for fname in fields] for el in data2]
		else:
			#TODO zrobic z tego array wtedy?
			data = flatten_dict(data)
		seria = simplejson.dumps(data, cls=DateTimeAwareJSONEncoder, ensure_ascii=False)

		# Callback
		if cb:
			return '%s(%s)' % (cb, seria)

		return seria

Emitter.register('array-json', ArrayJSONEmitter, 'application/json; charset=utf-8')

def deepUpdate(dst,src):
	if not src: return dst
	if not dst: return src
	if isinstance(src,dict): src = src.iteritems()
	for name, data in src:
		if name in dst: dst[name].update(data)
		else: dst[name] = data
	return dst

class ExtResource(Resource):
	def __init__(self,handler, authentication=None, authorization=None,**kwargs):
		super(ExtResource,self).__init__(handler, authentication=authentication, authorization=authorization)
		try:
			self.fields = flatten_fields(self.handler.fields)
		except:
			self.fields = [f.name for f in self.handler.model._meta.fields]

		#TODO to powinno byc w handlerze
		self.columns = flatten_fields2(self.handler)
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
		#print "extresource", hasattr(request, 'data'), request.method
		coerce_put_post(request)
		if not hasattr(request, 'data') and request.method in ['GET','PUT','POST']:
			#print request
			#print dir(request)
			#print request._post
			#print request.method,':',type(getattr(request,request.method)),getattr(request,request.method)
			data = dict([(k,v) for k,v in getattr(request,request.method).iteritems()])
		else: data = getattr(request,'data',{})

		#print 'data:', type(data), data

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
			print k,col
			if "__" in col['name'] and not col.get('fk',None): continue
			newcol = {'fieldLabel': col['header'], 'name': col['name']}
			if col.get('pk',None):
				newcol.update({'xtype': 'displayfield', 'hidden': True})
			elif 'fk' in col and col['fk']:
				newcol['xtype'] = col['type']+'.combo'
			elif col.get('choices',None):
				newcol.update({'xtype': 'combo', 'store': col['choices'], 'triggerAction': 'all', 'emptyText':'Wybież...', 'forceSelection': True, 'name': col['name'], 'hiddenName': col['name']})
			else:
				newcol['xtype'] = col['type']+'field'
			#if 'width' in col: del col['width']
			columns[k]=newcol
		return {'formFields':  simplejson.dumps(columns,sort_keys = settings.DEBUG,indent = 3), 'formFieldNames':simplejson.dumps(columns.keys(),sort_keys = settings.DEBUG,indent = 3)}
		#return {'formFields':  simplejson.dumps(columns,sort_keys = settings.DEBUG,indent = 3 if settings.DEBUG else None), 'formFieldNames':simplejson.dumps(columns.keys(),sort_keys = settings.DEBUG,indent = 3 if settings.DEBUG else None)}


	def render_grid(self, request, name = '', dictionary = None):
		columns = {}
		for k,col in self.columns.iteritems():
			col['dataIndex'] = col['name']
			columns[k]=col
		return {'gridColumns': simplejson.dumps(columns, sort_keys = settings.DEBUG,indent = 3), 'gridColumnNames':simplejson.dumps(columns.keys(),sort_keys = settings.DEBUG,indent = 3)}
		#return {'gridColumns': simplejson.dumps(columns, sort_keys = settings.DEBUG,indent = 3 if settings.DEBUG else None), 'gridColumnNames':simplejson.dumps(columns.keys(),sort_keys = settings.DEBUG,indent = 3 if settings.DEBUG else None)}

	def render_js(self, request, name, name2 = '', dictionary=None):
		"""
		JS can be rendered by calling api/$name/js/X, where X is a file name with or without .js extension.
		calling with no X assumes x=all
		"""
		name = (name or 'all').lower().replace('.js','') #normal default value doesn't work with (P..)? since django then passes None as a value
		name2 = (name2 or '').lower().replace('.js','')
		print 'render', name
		if name not in ['form','store','grid','combo','all']:
			raise Http404

		app_label = re.sub('\.?api.handlers','',self.handler.__module__) or 'main'

		if name2 in ['default','all']: name2 = ''
		defaults = {'fields': self.fields, 'verbose_name': self.verbose_name,'name':self.name, 'name2': name2, 'app_label':app_label}
		defaults.update(dict([(f, getattr(self,f)) for f in self.params.keys()]))

		#columns2 = simplejson.dumps(columns,sort_keys = settings.DEBUG,indent = 3 if settings.DEBUG else None) #display nice output only in debug mode
		#columns = [columns[k] for k in set(self.fields) & set(columns.keys())]
		#columns = simplejson.dumps(columns,sort_keys = settings.DEBUG,indent = 3 if settings.DEBUG else None) #display nice output only in debug mode

		if self.store_type == 'array':
			resp = self(request,emitter_format='array-json')
			defaults['data'] = resp.content
		#if name == 'grid': defaults.update(self.render_grid(request))
		#elif name == 'form': defaults.update(self.render_form(request))
		#else: defaults['columns'] = simplejson.dumps([self.columns[k] for k in set(self.fields) & set(self.columns.keys())],sort_keys = settings.DEBUG,indent = 3 if settings.DEBUG else None)
		defaults.update(self.render_grid(request))
		defaults.update(self.render_form(request))
		defaults['columns'] = simplejson.dumps([self.columns[k] for k in set(self.fields) & set(self.columns.keys())],sort_keys = settings.DEBUG,indent = 3)
		#defaults['columns'] = simplejson.dumps([self.columns[k] for k in set(self.fields) & set(self.columns.keys())],sort_keys = settings.DEBUG,indent = 3 if settings.DEBUG else None)
		defaults.update(dictionary or {})

		body = loader.get_template('mksoftware/%s.js.tpl'%name).render(Context(defaults,autoescape=False))
		body = re.sub("(?m)^[ \t]*\n",'',body) #remove whitespace in empty lines
		if not settings.DEBUG: body = re.sub("\t+\/\/.*",'',body) # remove comments
		return HttpResponse(body,mimetype='text/javascript')

def request_debug(func):
	def wrapper(self,request,*args,**kwargs):
		print self.__class__.__name__, func.__name__
		print 'data',request.data
		print 'params',request.params
		return func(self,request,*args,**kwargs)
	return wrapper

