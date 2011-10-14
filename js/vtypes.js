/*
 * $ Revision: $
 *
 * definicje walidacji
 */

Ext.apply(Ext.form.VTypes,{
	SubnetSpec: function(v){
		var re_sub = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\/\d{1,2}$/;
		var re_ip = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/;
		function testIP(ip) {
			if (!re_ip.test(ip)) return false;
			var tab=ip.split('.');
			for(var i=0;i<=3;i++) 
				if (tab[i]<0 || tab[i]>255) 
					return false;
			return true;
		};
		function testSub(sub) {
			if (!re_sub.test(sub)) 
				return testIP(sub);
			var tab = sub.split('/');
			if (tab[1]<1 || tab[1]>32) return false;
			return testIP(tab[0]);
		};
		var t=v.split('-');
		if (t.length==1) return testSub(v);
		if (t.length==2) return testIP(t[0]) && testIP(t[1]);
		return false;
	},
	SubnetSpecText:'Podaj adres sieci z maską lub zakres adresów IP'
});

