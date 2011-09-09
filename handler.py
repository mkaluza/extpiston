# $Revision: 1.9 $
# vim: set fileencoding=utf-8

from piston.handler import BaseHandler, typemapper
from piston.utils import rc

import django
from django.contrib.auth.models import Permission,Group,User
from django.core.exceptions import ObjectDoesNotExist, MultipleObjectsReturned
from django.db.models.fields import FieldDoesNotExist, related as related_fields, files as file_fields
from django.db.models.query import QuerySet

from functions import *
from internal import *

class ExtHandler(BaseHandler):
	exclude = ()

	def find_handler_by_name(self,name):
		#TODO handle 'not found'
		return filter(lambda handler: handler.__name__ == name, typemapper)[0]

	def find_handler_for_model(self,model):
		return filter(lambda handler: getattr(handler,'model',None) == model, typemapper)[0]

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
		#TODO obsluga relacji odwrotnej, ktora sie w tej petli nie pojawi
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

		#catch rev fields given in 'fields' property only

		for f in self.reverse_field_names:
			self._reverse_related_fields[f] = self.find_handler_for_field(f)

	def __init__(self):
		super(ExtHandler,self).__init__()

		m = self.model._meta

		#handler fields pseudofields and properties owned directly by the model
		self.local_field_names = set(filter(lambda f: isinstance(f,(str,unicode)), self.fields))

		#handler fields that are not model's fields
		self.nonmodel_field_names = set(self.local_field_names)-set([f.name for f in m.fields])
		#when we filter out m2m, all that's left is reverse related fields and properties
		self.reverse_field_names = self.nonmodel_field_names - set([f.name for f in m.many_to_many])
		#TODO filter out properties?

		self.columns = getattr(self, 'columns', {})

		self.file_fields = set(getattr(self, 'file_fields', []))
		self.m2m_handlers = getattr(self, 'm2m_handlers', {})
		self.reverse_related_fields = getattr(self, 'reverse_related_fields', [])	#TODO documentation
		self._reverse_related_fields = {}	#{'field_name': {params}}

		self.rpc = getattr(self, 'rpc', [])

		#provide defaults unless fields are already set
		self.name = getattr(self,'name', self.model._meta.object_name)
		self.pkfield = getattr(self, 'pkfield', self.model._meta.pk.name)
		self.verbose_name = getattr(self,'verbose_name', self.model._meta.verbose_name)

		self.setup_file_fields()
		self.setup_m2m_fields()
		self.setup_reverse_related_fields()

		self.value_field = getattr(self,'value_field',self.pkfield)
		self.display_field = getattr(self,'display_field','__str__')

		if 'data' in self.local_field_names:
			raise ValueError("Handler %s: There can't be (yet) a field named 'data'" % self.name)

	def queryset(self,request,*args, **kwargs):
		only = flatten_fields(self.fields, model=self.model, include_fk_pk = True)
		#print only
		fk = filter(lambda x: '__' in x,only)
		return super(ExtHandler,self).queryset(request).select_related(*fk)
		return super(ExtHandler,self).queryset(request,*args,**kwargs).select_related(depth=1)
		return super(ExtHandler,self).queryset(request,*args,**kwargs).only(*only)	#doesn't work

	def create(self, request, *args, **kwargs):
		if not self.has_model():
			return rc.NOT_IMPLEMENTED

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

			#potential fk fields
			for f in filter(lambda x:'__' in x,fields):
				fk = f.replace('__','_')
				if hasattr(inst,fk):
					setattr(inst,fk,attrs[f])
					fields.remove(f)

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
				ff.save(f.name,f,save=False)

			#TODO fails for inherited models?
			inst.save()

			return inst
		except self.model.MultipleObjectsReturned:
			return rc.DUPLICATE_ENTRY

	def update(self, request, *args, **kwargs):
		super(ExtHandler, self).update(request,  *args, **kwargs)

		inst = self.read(request,*args, **kwargs)

		attrs = self.flatten_dict(request.data)
		#potential fk fields
		fields=set(attrs.keys())
		for f in filter(lambda x:'__' in x,fields):
			fk = f.replace('__','_')
			if hasattr(inst,fk):
				setattr(inst,fk,attrs[f])	#TODO find a related object and assign it instead of id - then the read below won't be necessary
				fields.remove(f)

		inst.save()

		if len(fields): return self.read(request,*args, **kwargs)	#if foreign keys were updated, only *_id fields are set. Fields containig real referenced objects are not set and therefore need ot be
		return inst

	def read(self,request,*args,**kwargs):
		res  = super(ExtHandler,self).read(request,*args,**kwargs)
		if isinstance(res,QuerySet):
			for k,v in request.data.iteritems():
				if k.startswith('filter__') and v.strip() != '':
					k=str(k.replace('filter__','')+'__icontains')
					#TODO recognize filter commands and add default only if no other is given
					res = res.filter(**{k:v})
		return res

	@request_debug
	def exec_rpc_on_model(self,request,*args,**kwargs):
		proc = kwargs.pop('procname')
		obj = self.read(request,*args,**kwargs)
		proc = getattr(obj,proc)
		res = proc(request = request)
		return HttpResponse(simplejson.dumps(res))	#TODO resource should do it - handler doesn't care for http

class ManyToManyHandler(ExtHandler):
	allowed_methods = ('GET','POST','DELETE')

	def __init__(self, field = None):
		"""
		Initialize m2m handler.

		Force setting of fields:
			- self.model contains the model field relates to,
			- self.owner_model contains the model that owns the field,
			- self.field_name contains actual field name(for reverse objects it's not field.name
		The fields it returns are either (pk.name,__str__) or, if the model has a handler defined, value_field and display_field from the handler
		"""

		if field: self.field = field
		#if not hasattr(self,'model'):
		if issubclass(field.__class__, django.db.models.fields.related.ManyToManyField):
			self.model = field.rel.to
			self.owner_model = field.model
			self.field_name = field.name
		else:
			self.model = field.model
			self.owner_model = field.parent_model
			self.field_name = field.field.rel.related_name

		#TODO either get value_field/display_field from a default handler if a model has one or get pk/__str__
		self.fields = [self.model._meta.pk.name, '__str__']
		h = self.find_handler_for_model(self.model)()
		self.fields[0]=h.value_field
		self.fields[1]=h.display_field
		#print "m2m init", self.fields
		super(ManyToManyHandler,self).__init__()

	def create(self, request, *args, **kwargs):
		main_obj = self.owner_model.objects.get(pk=kwargs.get('main_id'))
		related_obj = self.model.objects.get(pk=request.data.get(self.model._meta.pk.name))
		getattr(main_obj,self.field_name).add(related_obj)
		return related_obj

	def delete(self, request, *args, **kwargs):
		main_obj = self.owner_model.objects.get(pk=kwargs.get('main_id'))
		related_obj = self.queryset(request,*args,**kwargs).get(pk=kwargs.get('id'))
		getattr(main_obj,self.field_name).remove(related_obj)
		return rc.DELETED

	def queryset(self, request, *args, **kwargs):
		#TODO to trzeba poprawic/skomentowac
		main_id = kwargs.pop('main_id', None)
		if main_id == None:
			main_id = self.main_id
		else: self.main_id = main_id

		main_obj = self.owner_model.objects.get(pk = self.main_id)
		if request.params.get('all',False):
			return self.model.objects.exclude(pk__in=getattr(main_obj,self.field.name).all().values('pk'))		#return remaining objects not assigned to our parent object
		else:
			return getattr(main_obj,self.field_name).all()

	def read(self, request, *args, **kwargs):
		#TODO metoda read musi podmieniac klucze, wtedy wszystko bedzie dzialac
		self.main_id = kwargs.pop('main_id')
		return super(ManyToManyHandler,self).read(request,*args,**kwargs)
