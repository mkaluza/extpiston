# $Revision: 1.9 $
# vim: set fileencoding=utf-8

from piston.handler import BaseHandler
from piston.utils import rc

from django.contrib.auth.models import Permission,Group,User
from django.core.exceptions import ObjectDoesNotExist, MultipleObjectsReturned
from django.db.models.fields import related as related_fields
from django.db.models.query import QuerySet

from functions import *
from internal import *

class ExtHandler(BaseHandler):
	exclude = ()
	def __init__(self):
		super(ExtHandler,self).__init__()
		if not hasattr(self,'name'): self.name = self.model._meta.object_name
		if not hasattr(self,'verbose_name'): self.verbose_name = self.model._meta.verbose_name
		if not hasattr(self,'m2m_handlers'): self.m2m_handlers = {}
		self.file_fields = set(getattr(self,'file_fields',[]))
		self.reverse_related_fields = getattr(self,'reverse_related_fields',[])
		self.rpc = getattr(self,'rpc',[])
		self.pkfield = getattr(self, 'pkfield', self.model._meta.pk.name)

	def queryset(self,request,*args, **kwargs):
		only = flatten_fields(self.fields, model=self.model, include_fk_pk = True)
		#print only
		fk = filter(lambda x: '__' in x,only)
		return super(ExtHandler,self).queryset(request,*args,**kwargs).select_related(*fk)
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
				setattr(inst,fk,attrs[f])
				fields.remove(f)

		inst.save()
		return inst

	def read(self,request,*args,**kwargs):
		res  = super(ExtHandler,self).read(request,*args,**kwargs)
		if isinstance(res,QuerySet):
			for k,v in request.data.iteritems():
				if k.startswith('filter__'):
					k=k.replace('filter__','')+'__icontains'
					#TODO recognize filter commands and add default only if no other is given
					res = res.filter(**{k:v})
		return res

	@request_debug
	def exec_rpc_on_model(self,request,*args,**kwargs):
		proc = kwargs.pop('procname')
		obj = self.read(request,*args,**kwargs)
		proc = getattr(obj,proc)
		res = proc()
		return HttpResponse(simplejson.dumps(res))	#TODO resource should do it - handler doesn't care for http

class ManyToManyHandler(ExtHandler):
	allowed_methods = ('GET','POST','DELETE')

	def __init__(self, field = None):
		if field: self.field = field
		if not hasattr(self,'model'): self.model = field.rel.to
		self.fields = (self.model._meta.pk.name,)
		#print "m2m init", self.fields
		super(ManyToManyHandler,self).__init__()

	def create(self, request, *args, **kwargs):
		f = self.field
		main_obj = f.model.objects.get(pk=kwargs.get('main_id'))
		related_obj = f.rel.to.objects.get(pk=request.data.get(f.rel.to._meta.pk.name))
		getattr(main_obj,f.name).add(related_obj)
		return related_obj

	def delete(self, request, *args, **kwargs):
		f = self.field
		main_obj = f.model.objects.get(pk=kwargs.get('main_id'))
		related_obj = self.queryset(request,*args,**kwargs).get(pk=kwargs.get('id'))
		getattr(main_obj,f.name).remove(related_obj)
		return rc.DELETED

	def queryset(self, request, *args, **kwargs):
		f = self.field
		main_id = kwargs.pop('main_id', None)
		if main_id == None:
			main_id = self.main_id
		else: self.main_id = main_id
		main_obj = f.model.objects.get(pk= self.main_id)
		return getattr(main_obj,f.name).all()

	def read(self, request, *args, **kwargs):
		#TODO metoda read musi podmieniac klucze, wtedy wszystko bedzie dzialac
		self.main_id = kwargs.pop('main_id')
		return super(ManyToManyHandler,self).read(request,*args,**kwargs)
