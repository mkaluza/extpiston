# vim: set fileencoding=utf-8
# $Id$
# $Revision$

import time

import logging
logger = logging.getLogger(__name__)

import inspect

from django.forms.models import model_to_dict

def lineno():
	"""Returns the current line number in our program."""
	return inspect.currentframe().f_back.f_lineno

def getFields(cursor):
	return [f[0] for f in cursor.description]

class Timer(object):
	def __init__(self, name=None):
		self.start=time.time()
		self.times=[['init',self.start]]
		self.name = name

	def __call__(self,desc = None):
		self.time(desc)

	def time(self,desc = None):
		if desc == None: desc = 'entry #%d' % len(self.times)

		self.times.append([desc,time.time()])

	def total(self):
		return self.times[len(self.times)-1][1]-self.start

	def show(self,desc=None):
		if not desc: desc = 'end'
		self.time(desc)
		total = self.total()
		if self.name:
			print "Timings for %s:" % self.name

		for i in range(1,len(self.times)):
			tm=self.times[i][1]-self.times[i-1][1]
			print "%-20s: %6.4f %3.1f%%" %(self.times[i][0],tm,100*tm/total)
			#logger.debug("%-20s: %6.4f %3.1f%%" %(self.times[i][0],tm,100*tm/total))
		print "%-20s: %6.4f\n" % ('Total',total)
		#logger.debug("%-20s: %6.4f" % ('Total',total))

def str_timedelta(dt):
	return "%d m %d s" % (dt.seconds/60,dt.seconds%60)

def pause(delay=None):
	if not delay:
		print "press enter"
		raw_input()
	else:
		print "sleeeeeeeep %d" %delay
		time.sleep(delay)

def mprint(obj, skip_defaults = True, show_nulls=False):
	for k,v in sorted(model_to_dict(obj).items(),key = lambda x: x[0]):
		f = obj._meta.get_field_by_name(k)[0]
		if v == f.default and skip_defaults: continue
		if (v != None and v != '') or show_nulls: print '%s:' % k,v

def mdiff(obj1, obj2):
	m1 = model_to_dict(obj1)
	m2 = model_to_dict(obj2)
	keys = sorted(set(m1.keys()) | set(m2.keys()))
	diffs = []
	for k in keys:
		if m1[k] != m2[k]:
			diffs.append(map(str, [k,m1[k],m2[k]]))
	#nice printing
	#TODO limit max length
	lengths = map(lambda a:map(len,a),diffs)	#calculate lengths of all strings
	array_max = lambda x,y: map(lambda a: max(*a), zip(x,y))	#calculate scalar max(A, B) where A and B are arrrays
	max_lengths = reduce(array_max, lengths)
	max_lengths = map(lambda x: x+2, max_lengths)		#add margin
	format_str = "%%-%ds: %%-%ds | %%-%ds" % tuple(max_lengths)
	for d in diffs: print format_str % tuple(d)

def request_debug(func):
	def wrapper(self,request,*args,**kwargs):
		print "REQUEST:",self.__class__.__name__, func.__name__
		try:
			print 'data',request.data
		except: pass
		try:
			print 'params',request.params
		except: pass
		print 'args', args
		print 'kwargs', kwargs
		return func(self,request,*args,**kwargs)
	return wrapper

def request_debug2(show_sql):	#this can only decorate class methods
	#TODO make parameter optional as in django.contrib.auth.decorators
	def _request_debug(func):
		def wrapper(self,request,*args,**kwargs):
			try:
				print 'data',request.data
			except: pass
			try:
				print 'params',request.params
			except: pass
			print 'args', args
			print 'kwargs', kwargs
			if show_sql: setattr(request,'FORCE_QUERY_DUMP',True)
			return func(self,request,*args,**kwargs)
		return wrapper
	return _request_debug

def copy_dict(src, keys = None, dst = None, overwrite = False, defaults = None, set_null_if_missing = False, overwrite_if_missing = False):
	"""Copy data from one dict to another

	src - source dictionary
	keys [None] - keys to copy. if not given, all src will be copied
	dst [None] - target dict, if not given, new one is created
	overwrite [False] - True to overwrite values in target dict
	defaults [None] - default values for those not found in src
	set_null_if_missing [False] - if key is neither in src nor defaults nor dst, set it to None when True. Useful to avoid KeyError later
	overwrite_if_missing [False] - if key is neither in src nor defaults, set it to None whether it exists or not when True. Works only when set_null_if_missing is True
	"""

	dst = dst or {}
	if defaults == None:
		defaults = {}
	else:
		defaults = defaults.copy()		#we need a copy here since we'll modify it later

	if not keys:
		#TODO merge defaults or not?
		if not dst:
			return dict(defaults, **src)	#return a copy with defaults applied (second arg are overrides)
			return src.copy()		#or without merging defaults

		return dict(dict(defaults, **src), **dst)
		return dict(src, **dst)			#or without merging defaults

	#prepare defaults
	for k in range(0,len(keys)):
		if isinstance(keys[k], (list, tuple)):
			key, val = keys[k][:2]
			keys[k] = key
			defaults[key] = val	#TODO check for overlaps

	available_keys = set(keys) & (set(src.keys()) | set(defaults.keys()))

	if set_null_if_missing:
		for k in set(keys) - available_keys:
			if k not in dst or overwrite_if_missing:
				dst[k] = None

	#copy
	for k in available_keys:
		v = src.get(k, defaults.get(k))			#this will always return a value since we only iterate available keys
		if k not in dst or overwrite:
			dst[k] = v
	return dst
	return dict([(k,src[k]) for k in keys if k in src])	#old one... things used to be simple...

def setup_params(obj, params_def, kwargs = None, ret_params = None):
	"""Setup obj's fields given in params_def with overrides given in kwargs

	params_def is a list of either strings (names) or tuples/lists like (param_name, default_value)
	kwargs - keyword arguments from a calling function
	ret_params is either:
		- a list of params to be returned as a tuple
		- a number N of how many first parameters should be returned
		- True when all parameters' values should be returned
	It can be used for initializing in_proc local variables

	Algorithm:
	1) kwargs override any value
	2) if field is already defined, it's left as is (unless overriden in #1)
	3) if field is not defined, it's set either to default value (if given) or None
	"""

	if kwargs == None: kwargs = {}
	param_names = []

	for p in params_def:
		if isinstance(p, (str, unicode)):
			p_name = p
			default = None
		elif isinstance(p, (list, tuple)):
			p_name = p[0]
			default = p[1]
		else:
			raise Exception("param_def should be either string or list/tuple of type (name, default_value)")

		param_names.append(p_name)
		#TODO to, czy null ma być zastępowany defaultem musi być jakoś parametryzowane, albo trzeba postępować standardowo
		#opcja jest taka, że nie ustawiamy na None, jeśli nie jest w obiekcie albo w kwargs
		#druga taka, że jest jakieś domyślne zachowanie, które może być per parametr przełączane (wtedy słownik)
		setattr(obj, p_name, kwargs.get(p_name, getattr(obj, p_name, None) or default))

	if ret_params:
		if isinstance(ret_params, (list, tuple)):
			return [ getattr(obj, name, None) for name in ret_params ]
		elif isinstance(ret_params, int):
			return [ getattr(obj, name, None) for name in param_names[:ret_params] ]
		elif ret_params == True:
			return [ getattr(obj, name, None) for name in param_names ]
