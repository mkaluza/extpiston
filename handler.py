# $Revision: 1.9 $
# vim: set fileencoding=utf-8

import inspect

from piston.handler import BaseHandler, typemapper
from piston.utils import rc

import django
from django.conf import settings
from django.contrib.auth.models import Permission,Group,User
from django.core.exceptions import ObjectDoesNotExist, MultipleObjectsReturned
from django.db.models.fields import FieldDoesNotExist, related as related_fields, files as file_fields
from django.db.models.query import QuerySet

from functions import *
from internal import *
from json import DefaultJSONEncoder, JS

class ExtHandler(BaseHandler):
	exclude = ()

	def find_handler_by_name(self,name):
		#TODO handle 'not found'
		handlers = filter(lambda handler: handler.__name__ == name or handler.__module__+'.'+handler.__name__ == name, typemapper)
		if len(handlers) > 1:
			print "Warning: Multiple handlers for name %s found\n" % name, handlers
		return handlers[0]

	def find_handler_for_model(self,model):
		try:
			handlers = filter(lambda handler: getattr(handler,'model',None) == model, typemapper)
			if len(handlers) > 1:
				print 'WARNING: multiple (%d) handlers for model %s' % (len(handlers), str(model))
			if len(handlers) == 0:
				print 'cant find handler for model %s' % str(model)
				return None
			return handlers[0]
		except:
			print 'error searching for handler for model %s' % str(model)
			raise
			return None

	def find_handler_for_field(self,field):
		#TODO check if field is a name or a field
		try:
			f = self.model._meta.get_field_by_name(field)[0]
			sub_handler = filter(lambda handler: typemapper[handler][0] == f.model, typemapper)[0]	#get default handler for model - has to be defined
		except FieldDoesNotExist:
			#we end up here for properties for example (they are given in 'fields', however they don't appear anyweher within model's _meta
			print"HANDLER %s: can't find field %s" % (self.name, field)
			return None
		except IndexError:
			print"HANDLER %s: can't find handler for rev field %s" % (self.name, f)
			return None
		#TODO if no handler is defined, create a read-only handler with pk and __str__ only
		return sub_handler

	def setup_file_fields(self):
		"""
		Find file fields that are in handler's fields property and are not explicitly specified in file_fields property
		"""
		for f in self.local_field_names-set(self.file_fields):
			try:
				field = self.model._meta.get_field_by_name(f)[0]
				if not isinstance(field, file_fields.FileField): continue
				self.file_fields.append(f)
			except FieldDoesNotExist:
				pass

	def setup_m2m_fields(self):
		_m2m_handlers = {}
		if isinstance(self.m2m_handlers, (list, tuple)):	#if it's a list
			for f in self.m2m_handlers:			#iterate through it
				#1. create handler based on field name
				if isinstance(f, (str, unicode)):	#strings are our model's field names
					field = self.model._meta.get_field_by_name(f)[0]	#get the field
					#_m2m_handlers[f] = type('TODO', (RelatedBaseHandler,), {'field': field})	#and create a subclass of RelatedBaseHandler configured to handle this relation TODO czy nazwy musza byc unikalne czy nie?
					_m2m_handlers[f] = type('TODO', (ManyToManyHandler,), {'field': field})	#and create a subclass of RelatedBaseHandler configured to handle this relation TODO czy nazwy musza byc unikalne czy nie?
				#2. it can be already defined class
				elif inspect.isclass(f):
					ff = f()
					_m2m_handlers[ff.field_name] = f
				elif isinstance(f, (list, tuple)):
					name = f[0]
					if isinstance(f[1], dict):
						#_m2m_handlers[f[0]] = type('TODO', (RelatedBaseHandler,), f[1])
						_m2m_handlers[f[0]] = type('TODO', (ManyToManyHandler,), f[1])
					else:
						raise ValueError('invalid value: ' + repr(f[1]))
				#3. tak jak w rev_rel poniżej (name, params {})
				#3. tak jak w rev_rel poniżej (name, handler name/full.class.name)
			self.m2m_handlers = _m2m_handlers

		#moze to tez byc słownik w postaci nazwa: klasa lub nazwa: nazwa.klasy - bez sensu?
		#TODO old (unneeded?) code
		for f in self.model._meta.many_to_many:
			if f.name in self.fields and f.name not in self.m2m_handlers:
				self.m2m_handlers[f.name] = ManyToManyHandler(field=f)

	def setup_reverse_related_fields(self):
		#go through fields given as property and set them right
		for f in self.reverse_related_fields:
			if type(f) == tuple:
				#some params for a field are given as tuple's second element
				f_name = f[0]

				if type(f[1])==dict:
					#if this is a dict, then more params are given
					params = f[1]
				else:
					#TODO check if potential handler's name is really a string
					#only a handler is given
					params = {'handler': f[1]}

				if isinstance(params['handler'],(str,unicode)):
					#just a handler class name is given, so we have to find a class
					params['handler'] = self.find_handler_by_name(params['handler'])
			else:
				#only a field name is given, search for a handler for the related model
				f_name = f
				params = {'handler': self.find_handler_for_field(f)}

			if params['handler']: self._reverse_related_fields[f_name] = params

		#TODO catch rev fields given in 'fields' property only

	def __init__(self, _only_for_subhandler_init = False):
		super(ExtHandler,self).__init__()

		m = self.model._meta

		#provide defaults unless fields are already set
		self.name = getattr(self,'name', self.model._meta.object_name)
		self.pkfield = getattr(self, 'pkfield', self.model._meta.pk.name)
		self.verbose_name = getattr(self,'verbose_name', self.model._meta.verbose_name)

		self.value_field = getattr(self,'value_field',self.pkfield)
		self.display_field = getattr(self,'display_field','__str__')

		self.security = getattr(self, 'security', getattr(settings, 'EXTPISTON_DEFAULT_SECURITY', False))

		#handler fields pseudofields and properties owned directly by the model
		self.local_field_names = set(filter(lambda f: isinstance(f,(str,unicode)), self.fields))

		#handler fields that are not model's fields
		self.nonmodel_field_names = set(self.local_field_names)-set([f.name for f in m.fields])
		#when we filter out m2m, all that's left is reverse related fields and properties
		#TODO this is not used!!
		self.reverse_field_names = self.nonmodel_field_names - set([f.name for f in m.many_to_many])
		#TODO filter out properties?

		self.columns = getattr(self, 'columns', {})

		self.file_fields = set(getattr(self, 'file_fields', []))
		self.m2m_handlers = getattr(self, 'm2m_handlers', {})
		self.reverse_related_fields = getattr(self, 'reverse_related_fields', [])	#TODO documentation
		self._reverse_related_fields = {}	#{'field_name': {params}}

		self.rpc = getattr(self, 'rpc', [])

		if _only_for_subhandler_init: return	#it's not a real init - a subhandler (for related field) is initializing and it needs the values from the real handler. This should help avoid infinite recursion

		self.setup_file_fields()
		self.setup_m2m_fields()
		self.setup_reverse_related_fields()

		if 'data' in self.local_field_names:
			raise ValueError("Handler %s: There can't be (yet) a field named 'data'" % self.name)

	def _check_security(self, request):
		perms = {'GET': 'view', 'PUT': 'change', 'DELETE': 'delete', 'POST': 'add'}
		#TODO make it smarter
		if not request.user.is_authenticated(): return False

		perm = perms[request.method]
		m = self.model._meta
		name = m.module_name
		app = m.app_label
		codename = "%s.%s_%s" % (app, perm, name)
		res = request.user.has_perm(codename)
		print "checking permission", codename, 'for', request.user, res
		return res

	def authorize(self, request):
		s = self.security
		if not s: return True

		if s == True:
			return self._check_security(request)
		elif s == 'login':
			if request.method == 'GET':
				return request.user.is_authenticated()
			else:
				return self._check_security(request)
		elif s == 'write':
			if request.method != 'GET':
				return self._check_security(request)
			else:
				return True
		#elif type(s) == dict:	#TODO...
		else:
			return True

	def queryset(self,request,*args, **kwargs):
		#if self.security:
		#	if not request.user.has_module_perms(self.
		only = flatten_fields(self.fields, model=self.model, include_fk_pk = True)
		#print only
		fk = filter(lambda x: '__' in x,only)
		return super(ExtHandler,self).queryset(request).select_related(*fk)
		return super(ExtHandler,self).queryset(request,*args,**kwargs).select_related(depth=1)
		return super(ExtHandler,self).queryset(request,*args,**kwargs).only(*only)	#doesn't work

	def update_fk_fields(self, inst, fields, attrs):
		#potential fk fields
		model_fields = inst._meta.get_all_field_names()
		for f in filter(lambda x:'__' in x, fields):
			try:
				local_field_name, fk_field_name = f.split('__')
				if not (hasattr(inst,local_field_name) or local_field_name in model_fields): continue		#hasattr may not be needed here

				field = self.model._meta.get_field_by_name(local_field_name)[0]
				if fk_field_name not in [field.rel.to._meta.pk.name, 'id']:
					#TODO if it's not a primary key then we can't be sure to be unique. We could instead update related objects property, but that's another story
					continue
				if attrs[f] == None:
					obj = None
				else:
					obj = field.rel.to.objects.get(**{fk_field_name: attrs[f]})	#TODO handle other relation types? are there any?
					#or .related.parent_model	#TODO a co z relacją o2o, tylko odwrotną?
				setattr(inst, local_field_name, obj)
			#except ObjectDoesNotExist:
			#	setattr(inst, local_field_name, None)
			except:
				pass
			fields.remove(f)

		return inst

	def remove_fields(self, request):
		fields = request.data.get('_remove_fields',None)
		if not fields: return
		del request.data['_remove_fields']
		for f in fields.split(','):
			if f in request.data:
				del request.data[f]

	def create(self, request, *args, **kwargs):
		if not self.has_model():
			return rc.NOT_IMPLEMENTED

		self.remove_fields(request)
		attrs = self.flatten_dict(request.data)

		try:
			pkfield = self.pkfield
			#if pkfield in attrs:
			#niepotrzebne - jak nie ma, to sie wywali, jak jest i nie znajdzie, to tez sie wywali, a jak znajdzie, to powie ze juz istnieje
			inst = self.queryset(request).get(pk=attrs[pkfield])
			return rc.DUPLICATE_ENTRY
		except (self.model.DoesNotExist, KeyError):
			modelfields=set(self.model._meta.get_all_field_names())
			fields=set(attrs.keys())
			modeldata = {}
			#Only model fields
			for f in fields & modelfields:
				modeldata[f] = attrs[f]
				fields.remove(f)

			inst = self.model(**modeldata)

			inst = self.update_fk_fields(inst, fields, attrs)

			#the rest (properties)
			for f in fields:
				try:
					if hasattr(inst,f): setattr(inst,f,attrs[f])
				except:
					#in case it's read only...
					#TODO more precise exception
					pass

			#handle file uploads
			for ff in set(request.FILES.keys()) & self.file_fields:
				f = request.FILES[ff]
				ff = getattr(inst,ff)
				ct = f.content_type
				if ct in  ['application/force-download', '', None]:
					try:
						import mimetypes
						mimetypes.init()
						ct = mimetypes.guess_type(f.name)[0]
					except:
						pass

				inst.content_type = ct
				ff.save(f.name,f,save=False)

			#TODO fails for inherited models?
			inst.save()

			return inst
		except self.model.MultipleObjectsReturned:
			return rc.DUPLICATE_ENTRY

	def update(self, request, *args, **kwargs):
		if hasattr(self, 'protected_fields'):
			for k in self.protected_fields:
				if k in request.data:
					del request.data[k]

		self.remove_fields(request)

		super(ExtHandler, self).update(request, *args, **kwargs)

		inst = self.read(request, *args, **kwargs)

		attrs = self.flatten_dict(request.data)
		#potential fk fields
		fields=set(attrs.keys())

		inst = self.update_fk_fields(inst, fields, attrs)

		inst.save()

		if len(fields): return self.read(request,*args, **kwargs)	#if foreign keys were updated, only *_id fields are set. Fields containig real referenced objects are not set and therefore need ot be
		return inst

	def read(self,request,*args,**kwargs):
		res  = super(ExtHandler,self).read(request,*args,**kwargs)
		if isinstance(res,QuerySet):
			for k,v in request.params.iteritems():
				if k.startswith('filter__') and v != '':	#'v.strip() != '':
					k=str(k.replace('filter__',''))
					if "__" not in k:
						k += '__icontains'
					#TODO recognize filter commands and add default only if no other is given
					res = res.filter(**{k:v})
		return res

	@request_debug
	def exec_rpc_on_model(self,request,*args,**kwargs):
		if not hasattr(request,'params'): request.params = {}
		if not hasattr(request,'data'): request.data = {}
		proc = kwargs.pop('procname')
		obj = self.read(request,*args,**kwargs)
		if isinstance(obj, HttpResponse): return obj
		proc = getattr(obj,proc)
		res = proc(request = request)
		if isinstance(res, HttpResponse): return res
		return HttpResponse(JS(res))	#TODO resource should do it - handler doesn't care for http or json

	@request_debug
	def exec_rpc(self,request,*args,**kwargs):
		if not hasattr(request,'params'): request.params = {}
		if not hasattr(request,'data'): request.data = {}
		proc = kwargs.pop('procname')
		proc = getattr(self,proc)
		res = proc(request = request, *args, **kwargs)
		if isinstance(res, HttpResponse): return res
		return HttpResponse(JS(res))	#TODO resource should do it - handler doesn't care for http or json

class RelatedBaseHandler(ExtHandler):
	allowed_methods = ('GET','POST','DELETE')
	register = False

	def __init__(self, **kwargs):
		"""
		Initialize m2m handler.

		Force setting of fields:
			- self.model contains the model field relates to,
			- self.owner_model contains the model that owns the field,
			- self.field_name contains actual field name of owner_model (for reverse objects it's not field.name)
		The fields it returns are either (pk.name,__str__) or, if the model has a handler defined, value_field and display_field from the handler
		"""

		field, field_name, model = setup_params(self, ['field', 'field_name', 'model', 'owner_model'], kwargs, ['field', 'field_name', 'model'])
		if 'pkfield' in kwargs: self.pkfield = kwargs['pkfield']	#TODO patrz komentarz w setup_params

		if not field:
			if field_name and model:
				field = model._meta.get_field_by_name(field_name)[0]
			else:
				raise Exception('Either field or field_name and model must be given')

		#TODO dobrze by było, jakby można było podać tylko model, a on by sobie resztę ogarnał

		#TODO jeśli znajdzie się handler poniżej, to trzeba ustalać priorytety, co jest ważniejsze (ewentualnie handler też może być podany w argumentach)
		if issubclass(field.__class__, django.db.models.fields.related.ManyToManyField):
			#TODO it should handle m2o as well, since all fields are the same
			setup_params(self, [('model', field.rel.to), ('owner_model', field.model), ('field_name', field.name)])
			self.rel_type = 'm2m'		#TODO for m2o it'll be different
		else:
			#reverse relation (RelatedObject) - for m2m i m2o its the same
			#TODO - though for implicit reverse relations it's different - class has a field named 'something', while instances have field 'something_set' - it also looks different in get_field_by_name
			setup_params(self, [('model', field.model), ('owner_model', field.parent_model), ('field_name', field.field.rel.related_name)])
			if issubclass(field.field.__class__, django.db.models.fields.related.ManyToManyField):
				self.rel_type = 'm2m'
			elif issubclass(field.field.__class__, django.db.models.fields.related.ForeignKey):
				self.rel_type = 'fk'

		fields = [self.model._meta.pk.name, '__str__']
		display_field = '__str__'
		value_field = self.model._meta.pk.name

		#TODO use handler parameter for this
		h = self.find_handler_for_model(self.model)
		if h:
			h=h(_only_for_subhandler_init = True)		#this skips initialization of all related fields
			fields[0] = value_field = h.value_field
			fields[1] = display_field = h.display_field
			self.pkfield = getattr(self,'pkfield',h.pkfield)
			self.security = getattr(self,'security', h.security)
		else:
			print "RelatedBaseHandler: warning: can't find handler for model", self.model

		self.orig_handler = h

		setup_params(self, [('fields', fields), ('value_field', value_field), ('display_field', display_field)], kwargs)

		def to_tuple(lst):
			if len(lst)>1:
				return (lst[0],to_tuple(lst[1:]))
			else:
				return (lst[0],)

		_fields = []
		for f in self.fields:
			if '__' in f and not f.startswith('__'):
				_fields.append(to_tuple(f.split('__')))
			else:
				_fields.append(f)
		self.fields = tuple(_fields)

		#print "m2m init", self.fields
		super(RelatedBaseHandler,self).__init__()

	#TOOD obejrzec, co z tym main_id, bo troche tu tego za dużo?
	def create(self, request, *args, **kwargs):
		main_obj = self.owner_model.objects.get(pk=kwargs.get('main_id'))
		related_obj = self.model.objects.get(pk=request.data.get(self.pkfield))
		getattr(main_obj,self.field_name).add(related_obj)
		return related_obj

	def delete(self, request, *args, **kwargs):
		main_obj = self.owner_model.objects.get(pk=kwargs.get('main_id'))
		related_obj = self.queryset(request,*args,**kwargs).get(pk=kwargs.get(self.pkfield))
		getattr(main_obj,self.field_name).remove(related_obj)
		return rc.DELETED

	def queryset(self, request, *args, **kwargs):
		#TODO to trzeba poprawic/skomentowac
		main_id = kwargs.pop('main_id', None)
		if main_id == None:
			main_id = self.main_id
		else: self.main_id = main_id

		main_obj = self.owner_model.objects.get(pk = self.main_id)
		self.main_obj = main_obj

		if self.orig_handler:		#TODO trzeba to jakoś pogodzić z parametrem model przekazywanym do init w argumentach
			q = self.orig_handler.queryset(request)
		else:
			q = self.model.objects.all()

		if request.params.get('all',False):
			if self.rel_type == 'fk': return q.filter(**{self.field.field.name+'__isnull':True})		#return only those not assigned to anybody
			return q.exclude(pk__in=getattr(main_obj,self.field_name).all().values('pk'))		#return remaining objects not assigned to our parent object
		else:
			if self.rel_type == 'fk': return q.filter(**{self.field.field.name: main_obj})
			return q.filter(pk__in=getattr(main_obj,self.field_name).all().values('pk'))		#do it like this, because if self.model is different than field.model (like inherited model for example), some things dont work (i.e. properties defined on inherited model)
		#return (main_obj,q)

	def read(self, request, *args, **kwargs):
		#TODO metoda read musi podmieniac klucze, wtedy wszystko bedzie dzialac
		self.main_id = kwargs.pop('main_id')
		return super(RelatedBaseHandler,self).read(request,*args,**kwargs)

class ManyToManyHandler(RelatedBaseHandler):
	def _check_security(self,request):
		if not request.user.is_authenticated(): return False

		om = self.owner_model._meta
		m = self.model._meta

		if request.method == 'GET':
			codename = "%s.view_%s" % (m.app_label, m.module_name)
			res = request.user.has_perm(codename)
		else:
			codename = "%s.assign_%s_to_%s" % (om.app_label, m.module_name, om.module_name) #app.assign_this_to_parent
			res = request.user.has_perm(codename)
			if not res:
				#TODO to nie może tak być  w 2 strony
				#TODO alternatywnie zrobić to jako pochodną uprawnień change na którymś (obu na raz) obiekcie
				codename = "%s.assign_%s_to_%s" % (om.app_label, om.module_name, m.module_name) #app.assign_this_to_parent
				res = request.user.has_perm(codename)
		print "checking permission", codename, 'for', request.user, res
		return res

class ReverseRelatedHandler(RelatedBaseHandler):
	pass
"""
class ManyToManyHandler(RelatedBaseHandler):
	def queryset(self, request, *args, **kwargs):
		main_obj, q = super(ManyToManyHandler, self).queryset(request, *args, **kwargs)
		if request.params.get('all',False):
			return q.exclude(pk__in=getattr(main_obj,self.field_name).all().values('pk'))		#return remaining objects not assigned to our parent object
			return self.model.objects.exclude(pk__in=getattr(main_obj,self.field_name).all().values('pk'))		#return remaining objects not assigned to our parent object
		else:
			return q.filter(pk__in=getattr(main_obj,self.field_name).all().values('pk'))		#do it like this, because if self.model is different than field.model (like inherited model for example), some things dont work (i.e. properties defined on inherited model)
			return self.model.objects.filter(pk__in=getattr(main_obj,self.field_name).all().values('pk'))		#do it like this, because if self.model is different than field.model (like inherited model for example), some things dont work (i.e. properties defined on inherited model)
			return getattr(main_obj,self.field_name).all()

class ReverseRelatedHandler(RelatedBaseHandler):
	def queryset(self, request, *args, **kwargs):
		main_obj, q = super(ReverseRelatedHandler, self).queryset(request, *args, **kwargs)
		if request.params.get('all',False):
			return q.filter(**{self.field.field.name+'__isnull':True})		#return only those not assigned to anybody
		else:
			return q.filter(**{self.field.field.name: main_obj})
"""
