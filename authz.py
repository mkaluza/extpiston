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
from django.db.models.query import QuerySet
from django.forms.models import model_to_dict
from django.http import HttpResponse, Http404
from django.shortcuts import render_to_response
from django.template import Context, loader
from django.utils import simplejson

import settings

from functions import Timer
from internal import *

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
